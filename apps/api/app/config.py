# 从 .env 文件读取运行时配置；get_settings() 通过 lru_cache 保证全进程单例
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    api_host: str = "0.0.0.0"
    api_port: int = 8710
    database_url: str = "sqlite:///./data/plankiller.db"
    timezone: str = "Asia/Shanghai"

    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_embedding_model: str = "text-embedding-3-small"
    rag_enabled: bool = True
    rag_top_k: int = 5

    deepseek_api_key: str = ""
    deepseek_model: str = "deepseek-chat"

    # QQ 开放平台机器人凭证；qq_bot_target_id 是接收提醒的用户 openid（非 QQ 号）
    qq_bot_app_id: str = ""
    qq_bot_secret: str = ""
    qq_bot_target_id: str = ""
    qq_bot_enabled: bool = False

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
