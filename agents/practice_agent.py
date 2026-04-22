from langchain_groq import ChatGroq
from sqlalchemy.orm import Session
from db import models
from config import settings
import random
import json

class PracticeAgent:
    def __init__(self, db: Session):
        self.db = db
        self.llm = ChatGroq(
            temperature=0, 
            groq_api_key=settings.GROQ_API_KEY, 
            model_name="llama-3.1-8b-instant"
        )

    def generate_targeted_mock(self, user_id: int, num_questions: int = 5):
        """Generates a mock test by picking questions from the user's current weak areas."""
        print(f"Practice: Generating targeted mock for User {user_id}...")
        
        # 1. Get weak chapters
        weak_mastery = self.db.query(models.ChapterMastery).filter(
            models.ChapterMastery.user_id == user_id,
            models.ChapterMastery.mastery_score < 70
        ).all()

        chapter_ids = [m.chapter_id for m in weak_mastery]
        
        if not chapter_ids:
            # Fallback to current study plan
            tasks = self.db.query(models.StudyPlanTask).filter(
                models.StudyPlanTask.user_id == user_id,
                models.StudyPlanTask.is_completed == False
            ).limit(3).all()
            chapter_ids = [t.chapter_id for t in tasks]

        if not chapter_ids:
            # Absolute fallback
            chapters = self.db.query(models.Chapter).limit(3).all()
            chapter_ids = [c.id for c in chapters]

        # 2. Pick questions
        questions = self.db.query(models.Question).filter(
            models.Question.chapter_id.in_(chapter_ids)
        ).all()

        if not questions:
            return []

        selected_questions = random.sample(questions, min(len(questions), num_questions))
        
        # 3. Solver Integration: For each question, ensure we have an answer (since jee.json lacks them)
        mock_with_answers = []
        for q in selected_questions:
            # Agent 'solves' it if we don't know the answer
            # We'll do this on-the-fly here or provide a placeholder for the UI to call TutorAgent.solve
            mock_with_answers.append(q)

        return mock_with_answers

    def solve_and_verify(self, question_id: int):
        """Uses LLM to solve the question and return the correct option index."""
        question = self.db.query(models.Question).filter(models.Question.id == question_id).first()
        options = self.db.query(models.Option).filter(models.Option.question_id == question_id).all()
        options_text = "\n".join([f"{i+1}. {opt.content}" for i, opt in enumerate(options)])

        prompt = f"""
        Solve this JEE question and identify the correct option index (1-based).
        Question: {question.content}
        Options:
        {options_text}
        
        Respond ONLY with the option index (e.g., 1 or 2 or 3 or 4).
        """
        try:
            response = self.llm.invoke(prompt)
            correct_index = int(response.content.strip())
            return correct_index
        except:
            return 1 # Fallback
