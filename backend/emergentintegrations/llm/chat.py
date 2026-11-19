import os
import requests


class FileContentWithMimeType:
    def __init__(self, file_path: str = "", mime_type: str = "", content: str = ""):
        self.file_path = file_path
        self.mime_type = mime_type
        self.content = content


class ImageContent:
    def __init__(self, image_base64: str = "", mime_type: str = "image/png"):
        self.image_base64 = image_base64
        self.mime_type = mime_type


class UserMessage:
    def __init__(self, text: str = "", file_contents=None, image_contents=None):
        self.text = text
        self.file_contents = file_contents or []
        self.image_contents = image_contents or []


class LlmChat:
    def __init__(self, api_key: str = "", session_id: str = "", system_message: str = ""):
        self.api_key = api_key or os.getenv("EMERGENT_LLM_KEY", "")
        self.session_id = session_id
        self.system_message = system_message
        self.provider = "openai"
        self.model = "gpt-4o-mini"

    def with_model(self, provider: str, model: str):
        self.provider = provider
        self.model = model
        return self

    async def send_message(self, user_message: UserMessage) -> str:
        messages = []
        if self.system_message:
            messages.append({"role": "system", "content": self.system_message})
        messages.append({"role": "user", "content": user_message.text})
        resp = requests.post(
            "https://integrations.emergentagent.com/llm/v1/chat/completions",
            headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
            json={"model": self.model, "messages": messages},
            timeout=60,
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]
