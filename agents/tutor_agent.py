from langchain_groq import ChatGroq
from sqlalchemy.orm import Session
from db import models
from config import settings
import json

class TutorAgent:
    def __init__(self, db: Session):
        self.db = db
        self.llm = ChatGroq(
            temperature=0, 
            groq_api_key=settings.GROQ_API_KEY, 
            model_name="llama-3.1-70b-versatile"
        )

    def explain_question(self, question_id: int, user_id: int, adaptive_level: str = "beginner"):
        """Solves a question and provides a conceptual explanation."""
        print(f"Tutor: Explaining Question {question_id} at {adaptive_level} level...")
        
        question = self.db.query(models.Question).filter(models.Question.id == question_id).first()
        if not question:
            return "Question not found."

        options = self.db.query(models.Option).filter(models.Option.question_id == question_id).all()
        options_text = "\n".join([f"{i+1}. {opt.content}" for i, opt in enumerate(options)])

        prompt = f"""
        You are a JEE Tutor. Your goal is to solve the following question and explain the core concept.
        
        Question: {question.content}
        Options:
        {options_text}

        Level: {adaptive_level}

        Format your response as follows:
        1. Correct Option Index (1-based)
        2. Steps to Solve
        3. Core Concept Explanation

        Respond in a clear, encouraging tone.
        """
        
        try:
            from schemas import SolvedQuestionOutput
            import datetime
            structured_llm = self.llm.with_structured_output(SolvedQuestionOutput)
            result = structured_llm.invoke(prompt)
            
            explanation_summary = f"""
            **Correct Option**: {result.correct_option_index}
            
            **Steps**:
            {chr(10).join(['- ' + s for s in result.steps])}
            
            **Concept**: {result.core_concept}
            
            {result.explanation_summary}
            """
            
            # Log the interaction
            interaction = models.AgentInteraction(
                user_id=user_id,
                agent_role="Tutor",
                input_query=f"Explain Question {question_id}",
                output_response=explanation_summary,
                timestamp=datetime.datetime.now().isoformat()
            )
            self.db.add(interaction)
            self.db.commit()
            
            return explanation_summary

        except Exception as e:
            print(f"Tutor: Error explaining question: {e}")
            return "Sorry, I encountered an error while trying to explain this question."
