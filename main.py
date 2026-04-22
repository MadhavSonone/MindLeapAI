from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import cast, String, Date
from typing import List
import datetime

from db.database import engine, get_db, SessionLocal
from db import models
import schemas
from orchestrator import SignalService
from agents.performance_analyst import PerformanceAnalyst
from agents.tutor_agent import TutorAgent
from agents.discipline_coach import DisciplineCoach
from graphs.strategy_graph import strategy_graph
from services.rag_service import rag_service
from fastapi.middleware.cors import CORSMiddleware
import json
from jose import JWTError, jwt
from passlib.context import CryptContext
import hashlib

# Auth Setup
SECRET_KEY = "mindleap_secret_key_change_me"
ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

def get_password_hash(password):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=7)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# Initialize DB Tables
models.Base.metadata.create_all(bind=engine)


app = FastAPI(title="MindLeapAI - Agentic Exam Prep")

# Add CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For development; restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Auth Endpoints ---

@app.post("/auth/register")
def register(body: dict, db: Session = Depends(get_db)):
    email = body.get("email")
    password = body.get("password")
    
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = models.User(
        email=email,
        hashed_password=get_password_hash(password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    token = create_access_token({"sub": str(user.id)})
    return {"token": token, "user_id": user.id, "email": user.email, "is_onboarded": False}

@app.post("/auth/login")
def login(body: dict, db: Session = Depends(get_db)):
    email = body.get("email")
    password = body.get("password")
    
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid credentials")
    
    user_prefs = db.query(models.UserPreferences).filter(models.UserPreferences.user_id == user.id).first()
    is_onboarded = user_prefs is not None
    
    prefs_data = {}
    if user_prefs:
        prefs_data = {
            "goalDate": user_prefs.goal_date,
            "dailyHours": user_prefs.daily_availability_hours,
            "targetExam": user_prefs.target_exam
        }
    
    token = create_access_token({"sub": str(user.id)})
    return {
        "token": token, 
        "user_id": user.id, 
        "email": user.email, 
        "is_onboarded": is_onboarded,
        "preferences": prefs_data
    }

# --- Orchestration Helpers ---

def run_orchestrator(user_id: int, db: Session):
    """
    The 'Core Brain' loop. 
    It checks for pending signals and triggers appropriate agents.
    """
    signals = SignalService.get_pending_signals(db)
    for signal in signals:
        print(f"Orchestrator: Processing signal {signal.signal_type}...")
        
        if signal.signal_type == "WEAK_TOPIC_DETECTED":
            # In the new flow, the planning graph or a feedback agent will handle this
            print(f"Orchestrator: Weakness detected. Signal processed.")
            
        elif signal.signal_type == "PLAN_UPDATED":
            pass
            
        SignalService.mark_signal_processed(db, signal.id)

# --- Endpoints ---

@app.post("/progress")
def submit_progress(progress: schemas.UserProgressCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # 1. Save Progress
    db_progress = models.UserProgress(
        user_id=progress.user_id,
        question_id=progress.question_id,
        status=progress.status,
        timestamp=datetime.datetime.now().isoformat()
    )
    db.add(db_progress)
    db.commit()

    # 2. Trigger Analyst & Orchestrator in background
    def background_processing():
        from graphs.study_graph import study_graph
        try:
            # Get chapter_id for the question
            db_bg = SessionLocal()
            question = db_bg.query(models.Question).filter(models.Question.id == progress.question_id).first()
            if question and question.chapter_id:
                # Trigger the LangGraph
                study_graph.invoke({
                    "user_id": progress.user_id,
                    "chapter_id": question.chapter_id,
                    "latest_status": progress.status,
                    "signals": [],
                    "next_action": ""
                })
            db_bg.close()
        except Exception as e:
            print(f"Graph Error: {e}")

    background_tasks.add_task(background_processing)
    
    return {"status": "accepted", "message": "Progress recorded and agents triggered."}

async def run_onboarding_pipeline(user_id: int, syllabus_info: dict, pyq_info: dict, state: dict):
    """
    Sequentially processes RAG ingestion then triggers the Strategy Graph.
    This ensures documents are available for the RAG node in the graph.
    """
    print(f"PIPELINE: Starting onboarding for user {user_id}")
    
    # 1. Process Syllabus
    if syllabus_info:
        try:
            rag_service.ingest_document(user_id, 0, syllabus_info['filename'], syllabus_info['content'], doc_type="syllabus")
        except Exception as e:
            print(f"PIPELINE: Syllabus ingestion failed: {e}")

    # 2. Process PYQs
    if pyq_info:
        try:
            rag_service.ingest_document(user_id, 0, pyq_info['filename'], pyq_info['content'], doc_type="pyq")
        except Exception as e:
            print(f"PIPELINE: PYQ ingestion failed: {e}")

    # 3. Trigger Strategy Graph
    print(f"PIPELINE: Triggering Strategy Graph for user {user_id}")
    try:
        strategy_graph.invoke(state)
    except Exception as e:
        print(f"PIPELINE: Strategy Graph failed: {e}")

# --- Agent Specialized Endpoints ---

@app.post("/agents/strategy/initialize")
async def initialize_strategy(
    background_tasks: BackgroundTasks,
    user_id: int = Form(...),
    goalDate: str = Form(...),
    dailyHours: int = Form(...),
    targetExam: str = Form(...),
    completedChapters: str = Form("[]"), # JSON string
    customSyllabus: str = Form(None),
    customPyqs: str = Form(None),
    syllabusFile: UploadFile = File(None),
    pyqFile: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    exam_type = "CUSTOM" if targetExam == "Custom" else "STANDARD"
    chapters_list = json.loads(completedChapters)
    
    # Ensure user preferences exist
    pref = db.query(models.UserPreferences).filter(models.UserPreferences.user_id == user_id).first()
    if not pref:
        pref = models.UserPreferences(
            user_id=user_id, 
            goal_date=goalDate,
            daily_availability_hours=dailyHours,
            target_exam=targetExam,
            completed_chapters=json.dumps(chapters_list),
            exam_type=exam_type,
            custom_syllabus=customSyllabus,
            custom_pyqs=customPyqs
        )
        db.add(pref)
    else:
        pref.goal_date = goalDate
        pref.daily_availability_hours = dailyHours
        pref.target_exam = targetExam
        pref.completed_chapters = json.dumps(chapters_list)
        pref.exam_type = exam_type
        pref.custom_syllabus = customSyllabus
        pref.custom_pyqs = customPyqs
    
    db.commit()
    
    # 3. Prepare Pipeline Data
    s_info = None
    if syllabusFile:
        s_content = await syllabusFile.read()
        s_info = {"filename": syllabusFile.filename, "content": s_content}
        # Add to DB
        doc = models.UserDocument(user_id=user_id, file_name=syllabusFile.filename, file_type="syllabus", file_content=s_content)
        db.add(doc)
    
    p_info = None
    if pyqFile:
        p_content = await pyqFile.read()
        p_info = {"filename": pyqFile.filename, "content": p_content}
        # Add to DB
        doc = models.UserDocument(user_id=user_id, file_name=pyqFile.filename, file_type="pyq", file_content=p_content)
        db.add(doc)
    
    db.commit()

    # 4. Trigger Sequential Pipeline
    pref = db.query(models.UserPreferences).filter(models.UserPreferences.user_id == user_id).first()
    all_chapters = db.query(models.Chapter).join(models.Subject).join(models.Exam).filter(models.Exam.name == targetExam).all()
    pending_chapters = [c.name for c in all_chapters if c.id not in chapters_list]

    state = {
        "user_id": user_id,
        "target_exam": targetExam,
        "goal_date": goalDate,
        "availability": dailyHours,
        "completed_chapters": [db.query(models.Chapter).filter(models.Chapter.id == cid).first().name for cid in chapters_list if db.query(models.Chapter).filter(models.Chapter.id == cid).first()],
        "pending_chapters": pending_chapters,
        "rag_context": "",
        "monthly_roadmap": {},
        "weekly_tasks": []
    }
    
    background_tasks.add_task(run_onboarding_pipeline, user_id, s_info, p_info, state)
    
    return {"status": "success", "message": "Onboarding pipeline (RAG + Planning) initiated."}

@app.post("/agents/strategy/recalibrate")
def recalibrate_strategy(body: dict, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    user_id = body.get("user_id")
    
    # 1. Clear existing future/pending tasks to prevent stacking
    today = datetime.date.today().isoformat()
    db.query(models.StudyPlanTask).filter(
        models.StudyPlanTask.user_id == user_id,
        models.StudyPlanTask.target_date >= today,
        models.StudyPlanTask.is_completed == False
    ).delete()
    db.commit()
    
    # 2. Collect current state
    pref = db.query(models.UserPreferences).filter(models.UserPreferences.user_id == user_id).first()
    if not pref: return {"error": "No preferences"}
    
    completed_ids = json.loads(pref.completed_chapters or "[]")
    all_chapters = db.query(models.Chapter).join(models.Subject).join(models.Exam).filter(models.Exam.name == pref.target_exam).all()
    pending_chapters = [c.name for c in all_chapters if c.id not in completed_ids]

    state = {
        "user_id": user_id,
        "target_exam": pref.target_exam,
        "goal_date": pref.goal_date,
        "availability": pref.daily_availability_hours,
        "completed_chapters": [db.query(models.Chapter).filter(models.Chapter.id == cid).first().name for cid in completed_ids if db.query(models.Chapter).filter(models.Chapter.id == cid).first()],
        "pending_chapters": pending_chapters,
        "rag_context": "",
        "monthly_roadmap": {},
        "weekly_tasks": []
    }
    
    background_tasks.add_task(strategy_graph.invoke, state)
    return {"status": "success", "message": "Recalibration graph initiated."}

@app.post("/tasks/{task_id}/toggle")
def toggle_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(models.StudyPlanTask).filter(models.StudyPlanTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.is_completed = not task.is_completed
    db.commit()
    return {"status": "success", "is_completed": task.is_completed}

@app.get("/stats/activity/{user_id}")
def get_activity_stats(user_id: int, db: Session = Depends(get_db)):
    # Simple activity score: count of completed tasks or mocks per day for last 30 days
    today = datetime.date.today()
    thirty_days_ago = (today - datetime.timedelta(days=30)).isoformat()
    
    # Get completed tasks
    tasks = db.query(models.StudyPlanTask.target_date).filter(
        models.StudyPlanTask.user_id == user_id,
        models.StudyPlanTask.is_completed == True,
        models.StudyPlanTask.target_date >= thirty_days_ago
    ).all()
    
    # Get mock attempts
    mocks = db.query(models.MockAttempt.timestamp).filter(
        models.MockAttempt.user_id == user_id,
        models.MockAttempt.timestamp >= thirty_days_ago
    ).all()
    
    # Merge dates
    activity_dates = [t.target_date for t in tasks]
    # 3. Include Task Completion
    tasks = db.query(models.StudyPlanTask.target_date).filter(
        models.StudyPlanTask.user_id == user_id,
        models.StudyPlanTask.is_completed == True
    ).all()
    activity_dates += [t[0] for t in tasks]
    
    # Count occurrences
    from collections import Counter
    counts = Counter(activity_dates)
    
    return [{"date": k, "count": v} for k, v in counts.items()]

@app.get("/agents/performance/heatmap", response_model=List[schemas.ChapterMastery])
def get_performance_heatmap(user_id: int, db: Session = Depends(get_db)):
    mastery = db.query(models.ChapterMastery).filter(models.ChapterMastery.user_id == user_id).all()
    return mastery

@app.get("/agents/tutor/explain/{question_id}")
def get_explanation(question_id: int, user_id: int, level: str = "beginner", db: Session = Depends(get_db)):
    tutor = TutorAgent(db)
    explanation = tutor.explain_question(question_id, user_id, level)
    return {"explanation": explanation}

@app.post("/agents/tutor/vault/chat")
def vault_chat(body: dict, db: Session = Depends(get_db)):
    user_id = body.get("user_id")
    query = body.get("query")
    tutor = TutorAgent(db)
    response = tutor.chat_vault(user_id, query)
    return {"response": response}

@app.get("/user/preferences/{user_id}")
def get_user_prefs(user_id: int, db: Session = Depends(get_db)):
    pref = db.query(models.UserPreferences).filter(models.UserPreferences.user_id == user_id).first()
    if not pref: return {}
    
    docs = db.query(models.UserDocument).filter(models.UserDocument.user_id == user_id).all()
    doc_list = [{"id": d.id, "name": d.file_name, "type": d.file_type, "status": d.processing_status} for d in docs]
    
    return {
        "custom_syllabus": pref.custom_syllabus,
        "custom_pyqs": pref.custom_pyqs,
        "target_exam": pref.target_exam,
        "documents": doc_list
    }

@app.delete("/vault/document/{doc_id}")
def delete_vault_document(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(models.UserDocument).filter(models.UserDocument.id == doc_id).first()
    if doc:
        db.delete(doc)
        db.commit()
    return {"status": "success"}

@app.post("/vault/upload")
async def upload_vault_document(
    background_tasks: BackgroundTasks,
    user_id: int = Form(...),
    file_type: str = Form(...), # syllabus, pyq, notes
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    content = await file.read()
    doc = models.UserDocument(
        user_id=user_id,
        file_name=file.filename,
        file_type=file_type,
        file_content=content
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    
    background_tasks.add_task(rag_service.ingest_document, user_id, doc.id, file.filename, content, doc_type=file_type)
    
    return {"status": "success", "file_name": file.filename}

@app.post("/user/preferences/update")
def update_user_prefs(body: dict, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    user_id = body.get("user_id")
    pref = db.query(models.UserPreferences).filter(models.UserPreferences.user_id == user_id).first()
    if pref:
        if "custom_syllabus" in body:
            pref.custom_syllabus = body["custom_syllabus"]
            if body["custom_syllabus"].strip():
                background_tasks.add_task(rag_service.ingest_document, user_id, -1, "custom_syllabus.txt", body["custom_syllabus"].encode(), doc_type="syllabus")
        
        if "custom_pyqs" in body:
            pref.custom_pyqs = body["custom_pyqs"]
            if body["custom_pyqs"].strip():
                background_tasks.add_task(rag_service.ingest_document, user_id, -2, "custom_pyqs.txt", body["custom_pyqs"].encode(), doc_type="pyq")
        
        db.commit()
    return {"status": "success"}

@app.get("/agents/map")
def get_agent_map():
    from graphs.study_graph import study_graph
    # Generate mermaid diagram
    try:
        mermaid_graph = study_graph.get_graph().draw_mermaid()
        return {"mermaid": mermaid_graph}
    except Exception as e:
        return {"error": str(e)}

@app.get("/subjects")
def get_subjects(exam_name: str = None, db: Session = Depends(get_db)):
    query = db.query(models.Subject)
    if exam_name:
        query = query.join(models.Exam).filter(models.Exam.name == exam_name)
    subjects = query.all()
    return [{"id": s.id, "name": s.name} for s in subjects]

@app.get("/subjects/{subjectId}/chapters")
def get_chapters(subjectId: int, db: Session = Depends(get_db)):
    chapters = db.query(models.Chapter).filter(models.Chapter.subject_id == subjectId).all()
    if not chapters:
        return []
    return chapters

@app.get("/chapters/{chapterId}/questions")
def get_questions(chapterId: int, db: Session = Depends(get_db)):
    questions = db.query(models.Question).filter(models.Question.chapter_id == chapterId).all()
    if not questions:
        return []
    return questions

@app.get("/stats/progress/{user_id}")
def get_chapter_progress(user_id: int, db: Session = Depends(get_db)):
    # Calculate solved vs total questions per chapter
    from sqlalchemy import func
    
    results = db.query(
        models.Chapter.id,
        models.Chapter.name,
        func.count(models.Question.id).label("total_questions"),
        func.count(models.UserProgress.id).label("solved_questions")
    ).outerjoin(models.Question, models.Chapter.id == models.Question.chapter_id)\
     .outerjoin(models.UserProgress, (models.Question.id == models.UserProgress.question_id) & (models.UserProgress.user_id == user_id))\
     .group_by(models.Chapter.id).all()
    
    return [
        {
            "chapter_id": r[0],
            "name": r[1],
            "total": r[2],
            "solved": r[3]
        } for r in results
    ]

@app.get("/dashboard/weekly/{user_id}")
def get_weekly_plan(user_id: int, db: Session = Depends(get_db)):
    today = datetime.date.today()
    week_later = today + datetime.timedelta(days=7)
    
    tasks = db.query(
        models.StudyPlanTask.id,
        models.StudyPlanTask.chapter_id,
        models.StudyPlanTask.task_type,
        models.StudyPlanTask.target_date,
        models.StudyPlanTask.estimated_minutes,
        models.StudyPlanTask.concepts,
        models.StudyPlanTask.is_completed,
        models.StudyPlanTask.priority,
        models.Chapter.name.label("chapter_name")
    ).join(models.Chapter).filter(
        models.StudyPlanTask.user_id == user_id,
        models.StudyPlanTask.target_date >= today.isoformat(),
        models.StudyPlanTask.target_date <= week_later.isoformat()
    ).order_by(models.StudyPlanTask.target_date, models.StudyPlanTask.priority.desc()).all()
    
    return [dict(t._mapping) for t in tasks]

@app.get("/dashboard/insight/{user_id}")
def get_dashboard_insight(user_id: int, db: Session = Depends(get_db)):
    from agents.discipline_coach import DisciplineCoach
    coach = DisciplineCoach(db)
    insight = coach.generate_adherence_report(user_id)
    return {"insight": insight}

@app.post("/agents/practice/schedule-mock")
def schedule_mock(body: dict, db: Session = Depends(get_db)):
    user_id = body.get("user_id")
    chapter_id = body.get("chapter_id")
    target_date = body.get("target_date")
    
    # Schedule for selected date or tomorrow
    if not target_date:
        target_date = (datetime.date.today() + datetime.timedelta(days=1)).isoformat()
        
    # Enforce maximum 1 mock per day
    existing_mock = db.query(models.StudyPlanTask).filter(
        models.StudyPlanTask.user_id == user_id,
        models.StudyPlanTask.target_date == target_date,
        models.StudyPlanTask.task_type == "MOCK"
    ).first()
    
    if existing_mock:
        return {"status": "error", "message": f"A mock test is already scheduled for {target_date}."}
    

    new_task = models.StudyPlanTask(
        user_id=user_id,
        chapter_id=chapter_id,
        task_type="MOCK",
        target_date=target_date,
        priority=3, # High priority for mocks
        is_completed=False
    )
    db.add(new_task)
    db.commit()
    return {"status": "success", "message": f"Unit mock scheduled for {target_date}"}
    
@app.get("/stats/streak/{user_id}")
def get_user_streak(user_id: int, db: Session = Depends(get_db)):
    # 1. Get dates from UserProgress (Mock tests/questions)
    progress_dates = db.query(
        cast(models.UserProgress.timestamp, String)
    ).filter(models.UserProgress.user_id == user_id).distinct().all()
    
    # 2. Get dates from completed StudyPlanTasks
    task_dates = db.query(models.StudyPlanTask.target_date).filter(
        models.StudyPlanTask.user_id == user_id,
        models.StudyPlanTask.is_completed == True
    ).all()
    
    # 3. Combine and deduplicate
    all_dates_list = []
    for d in progress_dates:
        if d[0]: all_dates_list.append(d[0].split('T')[0])
    for t in task_dates:
        if t[0]: all_dates_list.append(t[0])
        
    active_dates = sorted(list(set(all_dates_list)), reverse=True)
    
    if not active_dates:
        return {"streak": 0}
        
    streak = 0
    current_check = datetime.date.today()
    
    # Check if today or yesterday is the start of the streak
    if active_dates[0] != current_check.isoformat():
        current_check -= datetime.timedelta(days=1)
        if active_dates[0] != current_check.isoformat():
            return {"streak": 0}

    for date_str in active_dates:
        if date_str == current_check.isoformat():
            streak += 1
            current_check -= datetime.timedelta(days=1)
        else:
            break
            
    return {"streak": streak}

@app.get("/mock/generate")
def generate_mock_test(user_id: int, db: Session = Depends(get_db)):
    import random
    
    pref = db.query(models.UserPreferences).filter(models.UserPreferences.user_id == user_id).first()
    target_exam = pref.target_exam if pref else "JEE Main"

    # Get all chapters for the exam
    all_chapters = db.query(models.Chapter).join(models.Subject).join(models.Exam).filter(models.Exam.name == target_exam).all()
    if not all_chapters:
        return []

    TOTAL_TARGET = 20
    
    # 1. Preliminary target per chapter
    temp_target = max(1, TOTAL_TARGET // len(all_chapters))
    
    # 2. Filter chapters that have enough questions
    valid_chapters = []
    for ch in all_chapters:
        count = db.query(models.Question).filter(models.Question.chapter_id == ch.id).count()
        if count >= temp_target:
            valid_chapters.append(ch)
    
    # Fallback: If no chapters meet the quota, lower requirement to at least 1 question
    if not valid_chapters:
        for ch in all_chapters:
            count = db.query(models.Question).filter(models.Question.chapter_id == ch.id).count()
            if count >= 1:
                valid_chapters.append(ch)
    
    if not valid_chapters:
        return []

    # 3. Final target per chapter based on valid set
    per_chapter_target = TOTAL_TARGET // len(valid_chapters)
    if per_chapter_target == 0: per_chapter_target = 1
    
    mock_questions = []
    
    for ch in valid_chapters:
        ch_questions = db.query(
            models.Question.id,
            models.Question.content,
            models.Question.options_json,
            models.Chapter.name.label("chapter_name"),
            models.Subject.name.label("subject_name")
        ).select_from(models.Question).join(models.Chapter).join(models.Subject).filter(models.Question.chapter_id == ch.id).all()
        
        # Sample exactly per_chapter_target OR all available if less
        count_to_sample = min(len(ch_questions), per_chapter_target)
        if count_to_sample > 0:
            sampled = random.sample(ch_questions, count_to_sample)
            mock_questions.extend([dict(q._mapping) for q in sampled])
            
    random.shuffle(mock_questions)
    return mock_questions

@app.get("/mock/generate/unit/{chapter_id}")
def generate_unit_test(chapter_id: int, db: Session = Depends(get_db)):
    # Focused Practice: 15 questions from a single chapter
    import random
    questions = db.query(
        models.Question.id,
        models.Question.content,
        models.Question.options_json,
        models.Chapter.name.label("chapter_name")
    ).select_from(models.Question).join(models.Chapter).filter(models.Question.chapter_id == chapter_id).all()
    
    if len(questions) < 15:
        return [dict(q._mapping) for q in questions]
    return [dict(q._mapping) for q in random.sample(questions, 15)]

@app.post("/mock/submit")
def submit_mock_test(body: dict, db: Session = Depends(get_db)):
    user_id = body.get("user_id")
    answers = body.get("answers") # { question_id: answer_content }
    time_spent = body.get("time_spent", {}) # { question_id: seconds }
    
    score = 0
    total = len(answers)
    report = {} # { chapter_name: { correct: 0, total: 0 } }
    
    for q_id, user_ans in answers.items():
        question = db.query(models.Question).filter(models.Question.id == int(q_id)).first()
        if not question: continue
        
        is_correct = False
        if question.correct_answer:
            is_correct = user_ans.strip().lower() == question.correct_answer.strip().lower()
        
        # Record Progress
        db_progress = models.UserProgress(
            user_id=user_id,
            question_id=int(q_id),
            status="correct" if is_correct else "incorrect",
            timestamp=datetime.datetime.now().isoformat()
        )
        db.add(db_progress)

        chapter_name = question.chapter.name if question.chapter else "General"
        if chapter_name not in report:
            report[chapter_name] = {"correct": 0, "total": 0, "time": 0}
        
        report[chapter_name]["total"] += 1
        report[chapter_name]["time"] += time_spent.get(str(q_id), 0)
        
        if is_correct:
            score += 1
            report[chapter_name]["correct"] += 1

    # Format report for DB
    final_report = {k: {
        "accuracy": (v["correct"] / v["total"]) * 100,
        "avg_time": v["time"] / v["total"] if v["total"] > 0 else 0
    } for k, v in report.items()}
    
    # Generate Detailed AI Review
    analyst = PerformanceAnalyst(db)
    review_text = analyst.generate_detailed_review(user_id, final_report)
    
    import json
    attempt = models.MockAttempt(
        user_id=user_id,
        score=score,
        total_questions=total,
        report_json=json.dumps(final_report),
        answers_json=json.dumps(answers),
        time_spent_json=json.dumps(time_spent),
        review_text=review_text,
        timestamp=datetime.datetime.now().isoformat()
    )
    db.add(attempt)
    
    # Auto-complete related tasks for today
    today = datetime.date.today().isoformat()
    for chapter_name in report.keys():
        db_chapter = db.query(models.Chapter).filter(models.Chapter.name == chapter_name).first()
        if db_chapter:
            pending_task = db.query(models.StudyPlanTask).filter(
                models.StudyPlanTask.user_id == user_id,
                models.StudyPlanTask.chapter_id == db_chapter.id,
                models.StudyPlanTask.target_date == today,
                models.StudyPlanTask.is_completed == False
            ).first()
            if pending_task:
                pending_task.is_completed = True
                
    db.commit()
    
    return {"status": "success", "attempt_id": attempt.id, "score": score, "total": total}

@app.get("/mock/history/{user_id}")
def get_mock_history(user_id: int, db: Session = Depends(get_db)):
    attempts = db.query(models.MockAttempt).filter(models.MockAttempt.user_id == user_id).order_by(models.MockAttempt.timestamp.desc()).all()
    return attempts

@app.get("/mock/report/{attempt_id}")
def get_mock_report(attempt_id: int, db: Session = Depends(get_db)):
    attempt = db.query(models.MockAttempt).filter(models.MockAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    
    import json
    return {
        "score": attempt.score,
        "total": attempt.total_questions,
        "timestamp": attempt.timestamp,
        "report": json.loads(attempt.report_json),
        "review": attempt.review_text
    }
        