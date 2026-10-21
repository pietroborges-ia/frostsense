from datetime import datetime, timezone
from typing import List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pymongo import DESCENDING, MongoClient

# 1. Inicializa o FastAPI
app = FastAPI(title="FrostSense API", version="1.0")

# 2. Configuração de CORS (Permite que o seu site React acesse a API sem bloqueio)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Conexão com o MongoDB Atlas
# ⚠️ ATENÇÃO: Substitua o link abaixo pelo link que você usou para conectar no Compass!
MONGO_URI = "mongodb+srv://pietroborgesia_db_user:frostsense@frostsense.rlokiva.mongodb.net/"

client = MongoClient(MONGO_URI)
db = client["frostsense_db"]
colecao_leituras = db["leituras"]

# Cria um índice decrescente na data para deixar as buscas rápidas
colecao_leituras.create_index([("timestamp", DESCENDING)])

# Limite de alerta (ex: se passar de -12°C, ativa o alerta)
LIMITE_TEMPERATURA_MAX = -12.0


# 4. Modelos de Dados (Pydantic)
class LeituraEntrada(BaseModel):
    sensor_id: str = Field(..., example="freezer_01")
    temperatura: float = Field(..., example=-18.5)


class LeituraResposta(BaseModel):
    id: str
    sensor_id: str
    temperatura: float
    unidade: str
    status_alerta: bool
    timestamp: datetime


def formatar_leitura(doc) -> dict:
    return {
        "id": str(doc["_id"]),
        "sensor_id": doc["sensor_id"],
        "temperatura": doc["temperatura"],
        "unidade": doc.get("unidade", "C"),
        "status_alerta": doc["status_alerta"],
        "timestamp": doc["timestamp"],
    }


# 5. Rotas da API


@app.post("/leituras", response_model=LeituraResposta, status_code=201)
def registrar_leitura(dados: LeituraEntrada):
    """Recebe os dados do ESP32 e salva no MongoDB."""
    alerta = dados.temperatura > LIMITE_TEMPERATURA_MAX

    novo_documento = {
        "sensor_id": dados.sensor_id,
        "temperatura": round(dados.temperatura, 2),
        "unidade": "C",
        "status_alerta": alerta,
        "timestamp": datetime.now(timezone.utc),
    }

    resultado = colecao_leituras.insert_one(novo_documento)
    novo_documento["_id"] = resultado.inserted_id

    return formatar_leitura(novo_documento)


@app.get("/leituras/atual", response_model=LeituraResposta)
def obter_leitura_atual(sensor_id: str = "freezer_01"):
    """Retorna a última leitura para exibir no painel principal do site."""
    doc = colecao_leituras.find_one(
        {"sensor_id": sensor_id}, sort=[("timestamp", DESCENDING)]
    )
    if not doc:
        raise HTTPException(
            status_code=404, detail="Nenhuma leitura encontrada."
        )
    return formatar_leitura(doc)


@app.get("/leituras/historico", response_model=List[LeituraResposta])
def obter_historico(sensor_id: str = "freezer_01", limite: int = 50):
    """Retorna as últimas 50 leituras para montar o gráfico do site."""
    cursor = (
        colecao_leituras.find({"sensor_id": sensor_id})
        .sort("timestamp", DESCENDING)
        .limit(limite)
    )
    return [formatar_leitura(doc) for doc in cursor]