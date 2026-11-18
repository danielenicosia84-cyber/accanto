import os
import uuid

from emergentintegrations.llm.chat import LlmChat, UserMessage

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
AI_MODEL = ("gemini", "gemini-3-flash-preview")

SYSTEM_PROMPT = (
    "Sei Accanto, un assistente che aiuta i familiari (caregiver) a CAPIRE documenti sanitari. "
    "REGOLE FONDAMENTALI E INVIOLABILI: "
    "1) Spieghi e semplifichi il contenuto del documento in parole semplici. "
    "2) NON fai diagnosi, NON valuti la gravita', NON consigli cure, farmaci o terapie. "
    "3) Le tue spiegazioni sono SEMPRE ancorate al testo del documento: non inventare dati non presenti. "
    "4) Rinvia SEMPRE al medico curante per qualsiasi decisione clinica. "
    "5) Usa un linguaggio umano, caldo e molto semplice, adatto a persone con poca dimestichezza digitale. "
    "Se ti viene chiesto di valutare gravita' o dare consigli medici, rifiuta gentilmente e invita a parlare con il medico."
)


async def ai_text(system: str, prompt: str) -> str:
    chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"q-{uuid.uuid4()}", system_message=system).with_model(*AI_MODEL)
    resp = await chat.send_message(UserMessage(text=prompt))
    return resp if isinstance(resp, str) else str(resp)
