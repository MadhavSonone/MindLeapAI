from typing import TypedDict, List, Annotated
import operator
from langgraph.graph import StateGraph, END
from langchain_groq import ChatGroq
from db import models
from db.database import SessionLocal
from config import settings
from services.rag_service import rag_service
import json
import datetime
from pydantic import BaseModel, Field

# --- Schemas ---
class RoadmapWeekSchema(BaseModel):
    week_number: int
    focus_topics: List[str]
    intensity: str = Field(description="low, medium, or high")

class MonthlyRoadmapSchema(BaseModel):
    milestones: List[str]
    weeks: List[RoadmapWeekSchema]

class WeeklyTaskSchema(BaseModel):
    date: str
    chapter: str
    type: str = Field(description="LEARN, PRACTICE, REVISE, or MOCK")
    estimated_minutes: int
    concepts: str = Field(description="Clear, actionable instructions on exactly what to focus on within this chapter (e.g. 'Focus on deriving equations and solving numericals on the topic name' . Keep it under 2 sentences.")
    priority: int

class WeeklyPlanSchema(BaseModel):
    tasks: List[WeeklyTaskSchema]

# --- State ---
class PlanningState(TypedDict):
    user_id: int
    exam_type: str
    target_exam: str
    goal_date: str
    availability: int
    completed_chapters: List[str]
    pending_chapters: List[str]
    rag_context: str
    monthly_roadmap: dict
    weekly_tasks: List[dict]
    weekly_tasks: List[dict]
    weaknesses: List[str]
    srs_topics: List[str]

# --- Nodes ---

def rag_node(state: PlanningState):
    print(f"--- GRAPH: RAG Node (User {state['user_id']}) ---")
    query = f"Syllabus and PYQ patterns for {state['target_exam']} exam. Focus on pending topics: {', '.join(state['pending_chapters'][:10])}"
    context = rag_service.query(state['user_id'], query)
    return {"rag_context": context}

def srs_node(state: PlanningState):
    print("--- GRAPH: Simple SRS Node ---")
    db = SessionLocal()
    # Find topics attempted > 3 days ago
    three_days_ago = (datetime.datetime.now() - datetime.timedelta(days=3)).isoformat()
    
    stale_mastery = db.query(models.ChapterMastery).filter(
        models.ChapterMastery.user_id == state['user_id'],
        models.ChapterMastery.last_attempted_at < three_days_ago,
        models.ChapterMastery.mastery_score < 80  # only review if not fully mastered
    ).all()
    
    srs_topics = []
    for m in stale_mastery:
        ch = db.query(models.Chapter).filter(models.Chapter.id == m.chapter_id).first()
        if ch: srs_topics.append(ch.name)
        
    db.close()
    return {"srs_topics": srs_topics[:5]} # Limit to top 5 to avoid overwhelming


def goal_planner_node(state: PlanningState):
    print("--- GRAPH: Goal Planner Node ---")
    llm = ChatGroq(temperature=0, model_name="llama-3.3-70b-versatile", groq_api_key=settings.GROQ_API_KEY)
    
    prompt = f"""
    Role: Senior Academic Strategist.
    Target Exam: {state['target_exam']}
    Goal Date: {state['goal_date']}
    
    CONTEXT FROM DOCUMENTS:
    {state['rag_context'] if state['rag_context'] else "No document context available."}
    
    SYLLABUS (Pending):
    {', '.join(state['pending_chapters'])}
    
    TASK:
    Generate a 4-week high-level roadmap.
    1. Define key milestones.
    2. Group topics into 4 weeks.
    3. Assign intensity level to each week.
    
    Output MUST follow the Pydantic schema for MonthlyRoadmapSchema.
    """
    
    structured_llm = llm.with_structured_output(MonthlyRoadmapSchema)
    roadmap = structured_llm.invoke(prompt)
    
    print(f"Goal Planner Output: {roadmap.milestones}")
    return {"monthly_roadmap": roadmap.dict()}

def weekly_planner_node(state: PlanningState):
    print("--- GRAPH: Weekly Planner Node ---")
    llm = ChatGroq(temperature=0, model_name="llama-3.3-70b-versatile", groq_api_key=settings.GROQ_API_KEY)
    
    # We only plan for Week 1 of the current roadmap
    week1_focus = state['monthly_roadmap']['weeks'][0]['focus_topics']
    
    # Fetch Weaknesses from DB
    db = SessionLocal()
    weak_signals = db.query(models.AgentSignal).filter(
        models.AgentSignal.user_id == state['user_id'],
        models.AgentSignal.signal_type == "WEAK_TOPIC_DETECTED",
        models.AgentSignal.status == "PENDING"
    ).all()
    
    weak_topics = []
    for sig in weak_signals:
        payload = json.loads(sig.payload)
        ch_id = payload.get("chapter_id")
        ch = db.query(models.Chapter).filter(models.Chapter.id == ch_id).first()
        if ch: weak_topics.append(ch.name)
    db.close()

    prompt = f"""
    Role: Daily Task Optimizer.
    Target Exam: {state['target_exam']}
    Daily Window: {state['availability']} hours
    
    THIS WEEK'S FOCUS (from Monthly Roadmap):
    {', '.join(week1_focus)}
    
    IDENTIFIED WEAKNESSES (Prioritize these for REVISE/PRACTICE):
    {', '.join(weak_topics) if weak_topics else "None identified yet."}
    
    SRS REVIEWS (Topics forgetting curve requires review):
    {', '.join(state.get('srs_topics', [])) if state.get('srs_topics') else "No SRS reviews pending."}
    
    DOCUMENT CONTEXT:
    {state['rag_context'] if state['rag_context'] else "No document context available."}
    
    TASK:
    Create a granular 7-day study plan starting from {datetime.date.today()}.
    1. Only use topics from the 'Focus', 'Weaknesses', or 'SRS REVIEWS' lists.
    2. Mix LEARN, PRACTICE, and REVISE tasks.
    3. Use REVISE for weaknesses and SRS reviews.
    4. Ensure daily total minutes <= {state['availability'] * 60}.
    
    Output MUST follow the Pydantic schema for WeeklyPlanSchema.
    """
    
    structured_llm = llm.with_structured_output(WeeklyPlanSchema)
    plan = structured_llm.invoke(prompt)
    
    print(f"Weekly Planner Output: {len(plan.tasks)} tasks generated.")
    return {"weekly_tasks": [t.dict() for t in plan.tasks]}

def persistence_node(state: PlanningState):
    print("--- GRAPH: Persistence Node ---")
    db = SessionLocal()
    try:
        user_id = state['user_id']
        
        # 1. Save Monthly Roadmap
        roadmap_data = state['monthly_roadmap']
        db_roadmap = models.MonthlyRoadmap(
            user_id=user_id,
            exam_type=state['target_exam'],
            start_date=datetime.date.today().isoformat(),
            end_date=state['goal_date']
        )
        db.add(db_roadmap)
        db.commit()
        db.refresh(db_roadmap)
        
        for w in roadmap_data['weeks']:
            db_week = models.RoadmapWeek(
                roadmap_id=db_roadmap.id,
                week_number=w['week_number'],
                focus_topics=", ".join(w['focus_topics']),
                intensity=w['intensity']
            )
            db.add(db_week)
        
        # 2. Save Weekly Tasks
        for t in state['weekly_tasks']:
            # Find chapter
            db_chapter = db.query(models.Chapter).filter(models.Chapter.name.ilike(t['chapter'])).first()
            if db_chapter:
                db_task = models.StudyPlanTask(
                    user_id=user_id,
                    chapter_id=db_chapter.id,
                    task_type=t['type'],
                    target_date=t['date'],
                    estimated_minutes=t['estimated_minutes'],
                    concepts=t['concepts'],
                    priority=t['priority'],
                    is_completed=False
                )
                db.add(db_task)
        
        db.commit()
        print(f"Persistence: Successfully saved roadmap and tasks for user {user_id}")
    except Exception as e:
        print(f"Persistence Error: {e}")
        db.rollback()
    finally:
        db.close()
    
    return state

# --- Graph Construction ---
builder = StateGraph(PlanningState)

builder.add_node("rag", rag_node)
builder.add_node("srs", srs_node)
builder.add_node("goal_planner", goal_planner_node)
builder.add_node("weekly_planner", weekly_planner_node)
builder.add_node("persistence", persistence_node)

builder.set_entry_point("rag")
builder.add_edge("rag", "srs")
builder.add_edge("srs", "goal_planner")
builder.add_edge("goal_planner", "weekly_planner")
builder.add_edge("weekly_planner", "persistence")
builder.add_edge("persistence", END)

strategy_graph = builder.compile()
