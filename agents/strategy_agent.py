from langchain_groq import ChatGroq
from sqlalchemy.orm import Session
from db import models
from config import settings
from orchestrator import SignalService
import datetime
import json

class StrategyAgent:
    def __init__(self, db: Session):
        self.db = db
        self.llm = ChatGroq(
            temperature=0, 
            groq_api_key=settings.GROQ_API_KEY, 
            model_name="llama-3.3-70b-versatile"
        )

    def generate_initial_plan(self, user_id: int):
        pref = self.db.query(models.UserPreferences).filter(models.UserPreferences.user_id == user_id).first()
        if not pref:
            print("Strategy: User preferences not found. Cannot generate plan.")
            return  

        completed_ids = json.loads(pref.completed_chapters or "[]")
        completed_chapters = self.db.query(models.Chapter).filter(models.Chapter.id.in_(completed_ids)).all()
        completed_names = [c.name for c in completed_chapters]
        
        pending_chapters = self.db.query(models.Chapter).filter(~models.Chapter.id.in_(completed_ids)).limit(40).all()
        pending_names = [f"- {c.name}" for c in pending_chapters]
        syllabus_list = "\n".join(pending_names)

        prompt = f"""
        Role: {pref.target_exam} Strategy Expert.
        Target Date: {pref.goal_date} | Daily Study Window: {pref.daily_availability_hours} hours
        
        Current Progress: {len(completed_names)} chapters mastered. 
        Pending Syllabus Topics: {syllabus_list}
        {"Custom Context: " + (pref.custom_syllabus[:1000] if pref.custom_syllabus else "") if pref.exam_type == "CUSTOM" else ""}

        Task: Generate a strategic 7-day study plan starting from {datetime.date.today()}.
        Instructions:
        1. Distribute effort across the available syllabus topics.
        2. Assign 1-2 tasks per day.
        3. Ensure total minutes/day <= {pref.daily_availability_hours * 60}.
        4. Use task types: LEARN (new topics), PRACTICE (mastered topics), REVISE (concept review), MOCK (unit/full tests).
        5. Format as JSON only: {{"tasks": [{{"date": "YYYY-MM-DD", "chapter": "Name", "type": "...", "estimated_minutes": int, "concepts": "...", "priority": 1-3}}]}}
        """
        
        try:
            from schemas import StudyPlanOutput
            from pydantic import ValidationError
            import re

            # Try structured output first
            try:
                structured_llm = self.llm.with_structured_output(StudyPlanOutput)
                result = structured_llm.invoke(prompt)
                tasks = result.tasks
            except Exception as structured_err:
                print(f"Strategy: Structured output failed, falling back to manual parsing. Error: {structured_err}")
                # Fallback: Plain LLM call and manual JSON extraction
                raw_response = self.llm.invoke(prompt).content
                # Use regex to find JSON block
                json_match = re.search(r'\{.*\}', raw_response, re.DOTALL)
                if json_match:
                    json_str = json_match.group(0)
                    # Handle the case where LLM might have prefix like <function=...>
                    if "StudyPlanOutput" in json_str and "tasks" in json_str:
                        # Strip potential function tags
                        json_str = re.sub(r'<function=[^>]+>\s*', '', json_str)
                    
                    try:
                        data = json.loads(json_str)
                        tasks_data = data.get("tasks", [])
                        tasks = [StudyPlanOutput.Task(**t) for t in tasks_data]
                    except (json.JSONDecodeError, ValidationError) as parse_err:
                        print(f"Strategy: Manual parse failed: {parse_err}")
                        return
                else:
                    print("Strategy: No JSON found in raw response.")
                    return
            
            # Save to DB
            for task in tasks:
                # Use case-insensitive match for chapters
                db_chapter = self.db.query(models.Chapter).filter(
                    models.Chapter.name.ilike(task.chapter)
                ).first()
                
                if db_chapter:
                    # Check if task already exists for this day/chapter/user to avoid duplicates
                    existing = self.db.query(models.StudyPlanTask).filter(
                        models.StudyPlanTask.user_id == user_id,
                        models.StudyPlanTask.chapter_id == db_chapter.id,
                        models.StudyPlanTask.target_date == task.date
                    ).first()
                    
                    if not existing:
                        db_task = models.StudyPlanTask(
                            user_id=user_id,
                            chapter_id=db_chapter.id,
                            task_type=task.type,
                            target_date=task.date,
                            estimated_minutes=task.estimated_minutes,
                            concepts=task.concepts,
                            priority=task.priority,
                            is_completed=False
                        )
                        self.db.add(db_task)
            
            self.db.commit()
            print(f"Strategy: Initial plan generated for User {user_id}")
            
            SignalService.publish_signal(
                self.db, 
                user_id, 
                "PLAN_UPDATED", 
                "Strategy", 
                {"message": "Initial 7-day plan created."}
            )

        except Exception as e:
            print(f"Strategy: Critical error in generate_initial_plan: {e}")

    def respond_to_weakness(self, user_id: int, chapter_id: int, accuracy: float):
        """Adjusts the plan when a weakness is detected."""
        print(f"Strategy: Adjusting plan due to weakness in Chapter {chapter_id}...")
        
        # Add a REVISE task for tomorrow
        tomorrow = (datetime.date.today() + datetime.timedelta(days=1)).isoformat()
        
        db_task = models.StudyPlanTask(
            user_id=user_id,
            chapter_id=chapter_id,
            task_type="REVISE",
            target_date=tomorrow,
            priority=2, # Higher priority
            is_completed=False
        )
        self.db.add(db_task)
        self.db.commit()
        print(f"Strategy: Added REVISE task for Chapter {chapter_id} on {tomorrow}")
        
        SignalService.publish_signal(
            self.db, 
            user_id, 
            "PLAN_UPDATED", 
            "Strategy", 
            {"message": f"Added revision task for weak topic: {chapter_id}"}
        )
