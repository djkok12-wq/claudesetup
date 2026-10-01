FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV KPC_HOST=0.0.0.0 KPC_PORT=8000 KPC_DATA_DIR=/data
VOLUME /data
EXPOSE 8000
CMD ["python", "run.py"]
