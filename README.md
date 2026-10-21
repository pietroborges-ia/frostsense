<div align="center">

  # ❄️ FrostSense
  
  **Sistema IoT de Monitoramento Térmico Inteligente para Câmaras Frias e Refrigeradores Comerciais**

  <p align="center">
    <img src="https://img.shields.io/badge/Status-Em%20Desenvolvimento-0ea5e9?style=for-the-badge" alt="Status" />
    <img src="https://img.shields.io/badge/Projeto-Integrador-0284c7?style=for-the-badge" alt="Projeto Integrador" />
  </p>

  <!-- Badges da Stack Tecnológica -->
  <p align="center">
    <img src="https://img.shields.io/badge/ESP32-E7352C?style=flat-square&logo=espressif&logoColor=white" alt="ESP32" />
    <img src="https://img.shields.io/badge/C++-00599C?style=flat-square&logo=c%2B%2B&logoColor=white" alt="C++" />
    <img src="https://img.shields.io/badge/PlatformIO-FF7F00?style=flat-square&logo=platformio&logoColor=white" alt="PlatformIO" />
    <img src="https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python" />
    <img src="https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI" />
    <img src="https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white" alt="MongoDB" />
    <img src="https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB" alt="React" />
    <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite" />
  </p>
</div>

---

## 🧊 Sobre o Projeto

O **FrostSense** é um **Projeto Integrador** acadêmico desenvolvido do zero com o objetivo de solucionar um problema crítico no setor comercial e gastronômico: a perda de insumos e mercadorias causada por falhas invisíveis em sistemas de refrigeração.

Através da integração entre hardware **IoT (Internet das Coisas)** e uma plataforma web moderna, o sistema realiza a coleta contínua de dados térmicos diretamente do interior de freezers e câmaras frias, transmitindo as leituras em tempo real para um banco de dados não relacional na nuvem e exibindo métricas claras em um dashboard interativo.

---

## 🎯 Objetivos Principais

* **Prevenção de Perdas:** Identificar oscilações anormais de temperatura antes que comprometam a qualidade e a segurança dos produtos armazenados.
* **Monitoramento em Tempo Real:** Substituir verificações manuais esporádicas por leituras automatizadas, contínuas e precisas.
* **Histórico e Rastreabilidade:** Armazenar registros térmicos estruturados em documentos para auditoria, controle de qualidade e análise de desempenho dos equipamentos.
* **Acessibilidade Visual:** Fornecer uma interface limpa e responsiva para que gestores acompanhem o status de múltiplos refrigeradores de qualquer lugar.

---

## ⚡ Funcionalidades

- 🌡️ **Leitura Térmica de Alta Precisão:** Captura de dados através de sensores digitais à prova d'água acoplados ao microcontrolador ESP32.
- 🚨 **Sistema de Alertas Visuais:** Indicadores de status (Normal, Atenção, Crítico) baseados nas faixas de temperatura ideais de cada equipamento.
- 📊 **Dashboard em Tempo Real:** Gráficos dinâmicos de variação térmica e visualização rápida da temperatura atual, mínima e máxima.
- 🗄️ **Persistência Escalável (NoSQL):** Armazenamento ágil de séries de leituras de sensores utilizando **MongoDB Atlas**.
- 🔌 **API REST de Alta Performance:** Comunicação rápida e segura entre o hardware IoT e o frontend construída em **FastAPI**.

---

## 🛠️ Arquitetura do Sistema

O ecossistema do **FrostSense** é dividido em quatro camadas integradas:

1. **Camada Física (IoT & Firmware):** Microcontrolador **ESP32** programado em **C++ (PlatformIO)** integrado a sensores de temperatura **DS18B20**, responsável pela leitura física e envio dos pacotes via Wi-Fi (HTTP/JSON).
2. **Camada de Backend (API):** Servidor construído com **Python** e **FastAPI**, encarregado de validar os payloads recebidos do ESP32 e servir as rotas de consulta para o painel web.
3. **Camada de Dados (NoSQL):** Banco de dados não relacional **MongoDB**, ideal para a alta frequência de inserção de telemetria IoT.
4. **Camada de Visualização (Frontend):** Aplicação web desenvolvida em **React**, **TypeScript** e **Vite**, estilizada com temática voltada para cadeia de frio (*Cold Chain*).

---

## 📂 Estrutura do Repositório

```text
📦 FrostSense-Workspace
 ┣ 📂 FrostSense/          # Projeto de Firmware IoT (PlatformIO)
 ┃ ┣ 📂 include/           # Cabeçalhos e definições de constantes
 ┃ ┣ 📂 lib/               # Bibliotecas específicas de sensores
 ┃ ┣ 📂 src/
 ┃ ┃ ┗ 📜 main.cpp         # Código-fonte principal do ESP32
 ┃ ┗ 📜 platformio.ini     # Configurações da placa e dependências C++
 ┣ 📂 src/                 # Código-fonte do Frontend (React + TypeScript)
 ┣ 📜 vite.config.ts       # Configuração de build do Vite
 ┗ 📜 package.json         # Dependências e scripts da aplicação Web
