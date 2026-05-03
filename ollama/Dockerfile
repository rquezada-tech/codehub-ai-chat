FROM ollama/ollama:latest

WORKDIR /app

# Copy entrypoint script
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 11434

CMD ["/app/entrypoint.sh"]
