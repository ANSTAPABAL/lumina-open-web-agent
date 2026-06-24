FROM python:3.12-slim

WORKDIR /app

# Install python-docx library for Word document editing
RUN pip install --no-cache-dir python-docx

# Copy application code files
COPY server.py index.html app.js style.css pdf.min.js pdf.worker.min.js ./

# Expose port
EXPOSE 8000

# Start server
CMD ["python3", "-u", "server.py"]
