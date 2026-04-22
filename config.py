import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    GROQ_API_KEY: str = ""
    DATABASE_URL: str = "sqlite:///./database.db"
    
    model_config = SettingsConfigDict(env_file=".env")

settings = Settings()
