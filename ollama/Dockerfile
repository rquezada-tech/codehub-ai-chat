FROM ollama/ollama:latest

# El modelo se descarga en build time para que el container sea optimizado
# En producción, usar un volumen persistente para los modelos
RUN ollama pull mistral:7b-instruct-q4_0

# Alternatively, for a lighter model if RAM is an issue:
# RUN ollama pull llama3.2:1b-instruct-q4_0

EXPOSE 11434

# Ollama corre por defecto
CMD ["serve"]
