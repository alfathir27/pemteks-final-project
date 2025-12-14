import csv
import threading
import time
import random
from queue import Queue
from typing import List, Dict
import google.generativeai as genai

# ==================== KONFIGURASI ====================

# API Keys
API_KEYS = [
    "API_KEY"
]

# Jumlah worker threads
NUM_WORKERS = 50

REQUEST_DELAY = 2
ERROR_DELAY = 20.0

# File paths
INPUT_FILE = "newdata-5.csv"
OUTPUT_FILE = "newdata-5-out.csv"

# Persentase data yang akan dilabeling (0.0 - 1.0)
LABELING_PERCENTAGE = 1.0

# System prompt
SYSTEM_PROMPT = """Anda adalah sistem analisis sentimen yang sangat presisi. 

INSTRUKSI KETAT:
1. Analisis sentimen dari teks komentar yang diberikan
2. Anda HANYA boleh merespons dengan SATU kata berikut:
   - positive (jika sentimen positif/baik/senang/puas)
   - netral (jika sentimen netral/informatif/objektif)
   - negative (jika sentimen negatif/buruk/kecewa/marah)

3. TIDAK BOLEH ada penjelasan tambahan
4. TIDAK BOLEH ada tanda baca
5. TIDAK BOLEH ada kata lain selain: positive, netral, atau negative
6. Respons harus dalam huruf kecil semua
7. TIDAK BOLEH ada spasi di awal atau akhir

Contoh yang BENAR:
- positive
- netral
- negative

Contoh yang SALAH (JANGAN LAKUKAN INI):
- "Positive"
- "sentimen positive"
- "positive."
- "Sentimen dari teks ini adalah positive"
- "Berdasarkan analisis, saya menilai ini positive"

INGAT: Hanya respons dengan SATU kata: positive, netral, atau negative"""

api_key_index = 0
api_key_lock = threading.Lock()
results_dict = {}
results_lock = threading.Lock()
progress_count = 0
progress_lock = threading.Lock()

def get_next_api_key() -> str:
    global api_key_index
    with api_key_lock:
        key = API_KEYS[api_key_index]
        api_key_index = (api_key_index + 1) % len(API_KEYS)
        return key

def validate_sentiment(sentiment_text: str) -> str:
    # Hapus whitespace dan ubah ke lowercase
    sentiment = sentiment_text.strip().lower()
    
    # Cek apakah valid
    valid_sentiments = ["positive", "netral", "negative"]
    
    if sentiment in valid_sentiments:
        return sentiment
    else:
        # Jika tidak valid, cari kata kunci dalam response
        for valid in valid_sentiments:
            if valid in sentiment:
                return valid
        
        # Jika masih tidak valid, return None
        return None

def analyze_sentiment_with_gemini(text: str, api_key: str, retry_count: int = 3) -> str:
    for attempt in range(retry_count):
        try:
            # Konfigurasi Gemini dengan API key
            genai.configure(api_key=api_key)
            
            # Gunakan model Gemini
            model = genai.GenerativeModel(
                model_name='gemini-2.5-flash-lite',
                generation_config={
                    'temperature': 0.1,
                    'top_p': 0.95,
                    'top_k': 40,
                    'max_output_tokens': 10,  # Biar ga yapping
                }
            )
            
            # Buat prompt lengkap
            full_prompt = f"{SYSTEM_PROMPT}\n\nTEKS UNTUK DIANALISIS:\n{text}\n\nSENTIMEN:"
            
            # Generate response
            response = model.generate_content(full_prompt)
            
            # Ambil teks response
            sentiment_text = response.text
            
            # Validasi response
            validated = validate_sentiment(sentiment_text)
            
            if validated:
                # Delay setelah request sukses untuk menghindari rate limit
                time.sleep(REQUEST_DELAY)
                return validated
            else:
                print(f"Response tidak valid dari Gemini: '{sentiment_text}' - Retry {attempt + 1}/{retry_count}")
                time.sleep(ERROR_DELAY)
                
        except Exception as e:
            error_msg = str(e)
            print(f"Error saat analyze sentimen (attempt {attempt + 1}/{retry_count}): {error_msg}")
            
            # Jika resource exhausted, tunggu lebih lama
            if "resource" in error_msg.lower() or "exhausted" in error_msg.lower() or "429" in error_msg:
                print(f"Resource exhausted detected, menunggu {ERROR_DELAY * 2} detik...")
                time.sleep(ERROR_DELAY * 2)
            else:
                time.sleep(ERROR_DELAY)
            
            # Gunakan API key lain untuk retry
            if attempt < retry_count - 1:
                api_key = get_next_api_key()
                print(f"Mencoba dengan API key berikutnya...")
    
    # Jika semua retry gagal, return netral sebagai fallback
    print(f"Gagal menganalisis setelah {retry_count} percobaan, menggunakan 'netral' sebagai fallback")
    return "netral"

def update_progress(total: int):
    global progress_count
    with progress_lock:
        progress_count += 1
        print(f"Progress: {progress_count}/{total} ({progress_count/total*100:.1f}%)")

def worker(task_queue: Queue, total_tasks: int):
    while True:
        task = task_queue.get()
        
        if task is None:
            task_queue.task_done()
            break
        
        row_index, row_data = task
        
        try:
            # Ambil teks komentar
            teks_komentar = row_data['text']
            
            # Skip jika teks kosong
            if not teks_komentar or teks_komentar.strip() == '':
                sentiment = "netral"
            else:
                # Dapatkan API key untuk request ini
                api_key = get_next_api_key()
                
                # Analisis sentimen
                sentiment = analyze_sentiment_with_gemini(teks_komentar, api_key)
            
            # Simpan hasil ke results_dict
            with results_lock:
                results_dict[row_index] = sentiment
            
            # Update progress
            update_progress(total_tasks)
            
        except Exception as e:
            print(f"Error memproses baris {row_index}: {str(e)}")
            # Simpan sebagai netral jika error
            with results_lock:
                results_dict[row_index] = "netral"
            update_progress(total_tasks)
        
        finally:
            task_queue.task_done()

# ==================== MAIN FUNCTION ====================

def main():
    print("SENTIMENT LABELING MENGGUNAKAN GEMINI FLASH")
    print()
    print(f"Input file: {INPUT_FILE}")
    print(f"Output file: {OUTPUT_FILE}")
    print(f"Jumlah API Keys: {len(API_KEYS)}")
    print(f"Jumlah Workers: {NUM_WORKERS}")
    print(f"Request Delay: {REQUEST_DELAY}s")
    print(f"Error Delay: {ERROR_DELAY}s")
    print(f"Labeling Percentage: {LABELING_PERCENTAGE * 100}%")
    print()
    
    # Baca data dari CSV
    print("Membaca data dari CSV...")
    rows = []
    
    with open(INPUT_FILE, 'r', encoding='utf-8') as file:
        csv_reader = csv.DictReader(file)
        for row in csv_reader:
            rows.append(row)
    
    total_rows = len(rows)
    print(f"Berhasil membaca {total_rows} baris data")
    
    # Buat task queue
    task_queue = Queue()
    
    # Isi queue dengan tasks
    print("Membuat task queue...")
    skipped_count = 0
    for idx, row in enumerate(rows):
        if random.random() < LABELING_PERCENTAGE:
            task_queue.put((idx, row))
        else:
            skipped_count += 1
            
    print(f"Tasks added: {total_rows - skipped_count}")
    print(f"Skipped: {skipped_count}")
    
    # Buat dan start worker threads
    print(f"Memulai {NUM_WORKERS} worker threads...")
    threads = []
    for _ in range(NUM_WORKERS):
        t = threading.Thread(target=worker, args=(task_queue, total_rows))
        t.start()
        threads.append(t)
    
    # Tunggu semua tasks selesai
    print("Memproses data...")
    task_queue.join()
    
    # Stop workers
    for _ in range(NUM_WORKERS):
        task_queue.put(None)
    
    for t in threads:
        t.join()
    
    print("Semua worker selesai!")
    
    # Tulis hasil ke CSV baru
    print(f"Menulis hasil ke {OUTPUT_FILE}...")
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8', newline='') as file:
        # Ambil fieldnames dari data asli dan tambahkan kolom sentiment
        fieldnames = list(rows[0].keys())
        if 'sentiment' not in fieldnames:
            fieldnames.append('sentiment')
        
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        
        for idx, row in enumerate(rows):
            # Update kolom sentiment dengan hasil dari Gemini
            if idx in results_dict:
                row['sentiment'] = results_dict[idx]
            else:
                row['sentiment'] = "" # Kosongkan jika di-skip
            writer.writerow(row)
    
    print(f"Berhasil menulis {total_rows} baris ke {OUTPUT_FILE}")
    
    # Statistik hasil
    print("STATISTIK HASIL LABELING")
    
    sentiment_counts = {"positive": 0, "netral": 0, "negative": 0}
    for sentiment in results_dict.values():
        sentiment_counts[sentiment] = sentiment_counts.get(sentiment, 0) + 1
    
    print(f"Positive: {sentiment_counts['positive']} ({sentiment_counts['positive']/total_rows*100:.1f}%)")
    print(f"Netral: {sentiment_counts['netral']} ({sentiment_counts['netral']/total_rows*100:.1f}%)")
    print(f"Negative: {sentiment_counts['negative']} ({sentiment_counts['negative']/total_rows*100:.1f}%)")
    print("SELESAI!")

if __name__ == "__main__":
    main()

