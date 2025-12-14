from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

app = FastAPI()

import csv
import re
from collections import Counter
import requests
import time
import os
from dotenv import load_dotenv
import random
from datetime import datetime

load_dotenv()

news_cache = {
    "data": None,
    "timestamp": 0
}
price_cache = {
    "data": None,
    "timestamp": 0
}
tweets_cache = {
    "data": None,
    "timestamp": 0
}
airdrops_cache = {
    "data": None,
    "timestamp": 0
}
unlocks_cache = {
    "data": {},
    "timestamp": 0
}
articles_cache = {
    "data": {},
    "timestamp": 0
}
CACHE_DURATION = 30

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
}

# untuk samples
MATCH_LIMIT = 10 

@app.get("/api/tweets")
async def get_tweets():
    global tweets_cache
    current_time = time.time()

    if tweets_cache["data"] and (current_time - tweets_cache["timestamp"] < CACHE_DURATION):
        return tweets_cache["data"]

    print("Fetching Tweets from BullX...")
    try:
        url = "https://api-neo.bullx.io/v2/tweets"
        response = requests.get(url, headers=HEADERS)
        data = response.json()
        
        tweets_cache["data"] = data
        tweets_cache["timestamp"] = current_time
        return data
    except Exception as e:
        print(f"Error fetching Tweets: {e}")
        if tweets_cache["data"]:
            return tweets_cache["data"]
        return []

@app.get("/api/prices")
async def get_prices():
    global price_cache
    current_time = time.time()

    if price_cache["data"] and (current_time - price_cache["timestamp"] < CACHE_DURATION):
        return price_cache["data"]

    print("Fetching prices from CoinDesk...")
    try:
        url = "https://www.coindesk.com/exchange-api/trading-api/v1/index-prices"
        response = requests.get(url)
        data = response.json()
        
        target_symbols = ["BTC", "ETH", "SOL", "XRP", "DOGE", "ADA", "AVAX", "DOT", "TRX", "LINK", "MATIC", "LTC", "UNI", "BCH", "XLM"]
        
        filtered_prices = []
        for item in data:
            if item.get("assetSymbol") in target_symbols:
                filtered_prices.append({
                    "symbol": item.get("assetSymbol"),
                    "price": float(item.get("price", 0)),
                })
        
        filtered_prices.sort(key=lambda x: x["price"], reverse=True)
        
        price_cache["data"] = filtered_prices
        price_cache["timestamp"] = current_time
        return filtered_prices
        
    except Exception as e:
        print(f"Error fetching prices: {e}")
        if price_cache["data"]:
            return price_cache["data"]
        return []

@app.get("/api/news")
async def get_news():
    global news_cache
    current_time = time.time()
    
    if news_cache["data"] and (current_time - news_cache["timestamp"] < CACHE_DURATION):
        print("Serving news from cache")
        return news_cache["data"]
    
    print("Fetching news from external API (CoinDesk)...")
    try:
        url = "https://data-api.coindesk.com/news/v1/article/list?lang=EN&limit=50&api_key=cebde5550872500bc2959bc492b123182981b5494a198c701eb4c2bad65a7198"
        response = requests.get(url)
        data = response.json()
        
        if "Data" in data and isinstance(data["Data"], list):
            transformed_news = []
            for item in data["Data"]:
                news_item = {
                    "title": item.get("TITLE", "No Title"),
                    "url": item.get("URL", "#"),
                    "imageurl": item.get("IMAGE_URL", ""), 
                    "source_info": {"name": "CoinDesk"},
                    "published_on": item.get("PUBLISHED_ON", int(time.time()))
                }
                transformed_news.append(news_item)
            
            final_data = {"Data": transformed_news}
            
            news_cache["data"] = final_data
            news_cache["timestamp"] = current_time
            return final_data
        else:
            if news_cache["data"]:
                return news_cache["data"]
            return {"Data": []}
            
    except Exception as e:
        print(f"Error fetching news: {e}")
        if news_cache["data"]:
            return news_cache["data"]
        return {"Message": str(e), "Data": []}

@app.get("/api/airdrops")
async def get_airdrops(page: int = 0, size: int = 10):
    global airdrops_cache
    current_time = time.time()
    
    cache_key = f"{page}_{size}"
    
    if not isinstance(airdrops_cache["data"], dict):
        airdrops_cache["data"] = {}

    if cache_key in airdrops_cache["data"] and (current_time - airdrops_cache["timestamp"] < CACHE_DURATION):
        return airdrops_cache["data"][cache_key]

    print(f"Fetching airdrops page {page}...")
    try:
        url = 'https://api2.dropstab.com/portfolio/api/activity/withPreset'
        headers = {
            'Accept': '*/*',
            'Accept-Language': 'id,id-ID;q=0.9,en-US;q=0.8,en;q=0.7,ms;q=0.6',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Origin': 'https://dropstab.com',
            'Pragma': 'no-cache',
            'Referer': 'https://dropstab.com/',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-site',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
            'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"'
        }
        data = {
            "sortField": "statusUpdatedAt",
            "order": "DESC",
            "page": page,
            "size": size,
            "filters": {
                "isDraft": False,
                "statusesExcluded": ["ENDED"]
            }
        }
        
        response = requests.post(url, headers=headers, json=data)
        response.raise_for_status()
        result = response.json()
        
        airdrops_cache["data"][cache_key] = result
        airdrops_cache["timestamp"] = current_time
        
        return result
    except Exception as e:
        print(f"Error fetching airdrops: {e}")
        return {"content": [], "totalElements": 0}

@app.get("/api/unlocks")
async def get_unlocks(page: int = 0, size: int = 10):
    current_time = time.time()
    cache_key = f"{page}_{size}"
    
    if current_time - unlocks_cache["timestamp"] < CACHE_DURATION and cache_key in unlocks_cache["data"]:
        return unlocks_cache["data"][cache_key]

    try:
        url = 'https://api2.dropstab.com/portfolio/api/markets'
        headers = {
            'Accept': '*/*',
            'Accept-Language': 'id,id-ID;q=0.9,en-US;q=0.8,en;q=0.7,ms;q=0.6',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Origin': 'https://dropstab.com',
            'Pragma': 'no-cache',
            'Referer': 'https://dropstab.com/',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-site',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
            'authorization': 'undefined',
            'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"'
        }
        
        data = {
            "fields": [
                "currencyId", "rank", "name", "symbol", "image", "slug", "price", 
                "rankChange", "change", "marketCap", "circulatingSupplyPercent", 
                "circulatingSupply", "maxSupply", "totalSupply", "fundraisingBaseData"
            ],
            "filters": {
                "vestingPeriod": True,
                "nextUnlockMarketCapSharePercent": {"from": 0.5, "to": None},
                "nextUnlockUsdAmount": {"from": 1000000, "to": None},
                "leadInvestorCondition": "OR",
                "categoryCondition": "OR",
                "exchangeCondition": "OR",
                "followerCondition": "OR",
                "icoPlatformCondition": "OR",
                "investorCondition": "OR"
            },
            "sort": "next_unlock_date",
            "order": "ASC",
            "sortRange": "FULL",
            "page": page,
            "size": size
        }
        
        response = requests.post(url, headers=headers, json=data)
        response.raise_for_status()
        result = response.json()
        
        unlocks_cache["data"][cache_key] = result
        unlocks_cache["timestamp"] = current_time
        
        return result
    except Exception as e:
        print(f"Error fetching unlocks: {e}")
        return {"content": [], "totalElements": 0}

@app.get("/api/articles")
async def get_articles(page: int = 1, size: int = 20):
    current_time = time.time()
    cache_key = f"{page}_{size}"
    
    if current_time - articles_cache["timestamp"] < CACHE_DURATION and cache_key in articles_cache["data"]:
        return articles_cache["data"][cache_key]

    try:
        url = 'https://content.vfuucesdbgvp.dropstab.com/api/articles'
        params = {
            'pagination[page]': page,
            'pagination[pageSize]': size,
            'sort': 'createdAt:desc',
            'locale': 'en',
        }
        headers = {
            'accept': '*/*',
            'accept-language': 'id,id-ID;q=0.9,en-US;q=0.8,en;q=0.7,ms;q=0.6',
            'authorization': 'undefined',
            'cache-control': 'no-cache',
            'origin': 'https://dropstab.com',
            'pragma': 'no-cache',
            'priority': 'u=1, i',
            'referer': 'https://dropstab.com/',
            'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-site',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
        }
        
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        result = response.json()
        
        articles_cache["data"][cache_key] = result
        articles_cache["timestamp"] = current_time
        
        return result
    except Exception as e:
        print(f"Error fetching articles: {e}")
        return {"data": [], "meta": {}}

@app.get("/api/sentiment")
async def get_sentiment(start_date: str = None, end_date: str = None, source: str = None):
    try:
        csv_path = os.path.join("static", "data_dashboard_final.csv")
        
        if not os.path.exists(csv_path):
            return {"error": "CSV file not found", "data": None}

        total = 0
        positive = 0
        neutral = 0
        negative = 0

        with open(csv_path, mode='r', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                try:
                    if source and source != "All" and row.get("sumber") != source:
                        continue

                    if start_date and end_date:
                        row_date_str = row.get("created_at", "").split(" ")[0]
                        if not row_date_str:
                            continue
                        
                        row_date = datetime.strptime(row_date_str, "%Y-%m-%d")
                        start = datetime.strptime(start_date, "%Y-%m-%d")
                        end = datetime.strptime(end_date, "%Y-%m-%d")

                        if not (start <= row_date <= end):
                            continue

                    label = float(row.get("label_code", -1))
                    if label == 1.0:
                        positive += 1
                        total += 1
                    elif label == 0.0:
                        neutral += 1
                        total += 1
                    elif label == 2.0:
                        negative += 1
                        total += 1
                except ValueError:
                    continue

        if total == 0:
            return {
                "total": 0,
                "positive": 0,
                "neutral": 0,
                "negative": 0,
                "score": 0,
                "label": "No Data",
                "color": "#9ca3af"
            }

        score = ((positive * 100) + (neutral * 50) + (negative * 0)) / total
        final_score = round(score)

        label_text = 'Neutral'
        color = '#f59e0b'

        if final_score >= 75:
            label_text = 'Extreme Greed'
            color = '#10b981'
        elif final_score >= 55:
            label_text = 'Greed'
            color = '#34d399'
        elif final_score <= 25:
            label_text = 'Extreme Fear'
            color = '#ef4444'
        elif final_score <= 45:
            label_text = 'Fear'
            color = '#f87171'

        return {
            "total": total,
            "positive": positive,
            "neutral": neutral,
            "negative": negative,
            "score": final_score,
            "label": label_text,
            "color": color
        }

    except Exception as e:
        print(f"Error processing sentiment: {e}")
        return {"error": str(e)}

@app.get("/api/wordcloud")
async def get_wordcloud(start_date: str = None, end_date: str = None, source: str = None):
    try:
        csv_path = os.path.join("static", "data_dashboard_final.csv")
        
        if not os.path.exists(csv_path):
            return {"error": "CSV file not found", "data": None}

        word_counts = {
            "positive": Counter(),
            "neutral": Counter(),
            "negative": Counter()
        }

        with open(csv_path, mode='r', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                try:
                    if source and source != "All" and row.get("sumber") != source:
                        continue

                    if start_date and end_date:
                        row_date_str = row.get("created_at", "").split(" ")[0]
                        if not row_date_str:
                            continue
                        
                        row_date = datetime.strptime(row_date_str, "%Y-%m-%d")
                        start = datetime.strptime(start_date, "%Y-%m-%d")
                        end = datetime.strptime(end_date, "%Y-%m-%d")

                        if not (start <= row_date <= end):
                            continue

                    text = row.get("text_stopwords", "")
                    label = float(row.get("label_code", -1))
                    
                    text = re.sub(r'[^\w\s]', '', text).lower()
                    words = text.split()
                    
                    if label == 1.0:
                        word_counts["positive"].update(words)
                    elif label == 0.0:
                        word_counts["neutral"].update(words)
                    elif label == 2.0:
                        word_counts["negative"].update(words)
                        
                except ValueError:
                    continue

        result = {
            "positive": [[word, count] for word, count in word_counts["positive"].most_common(50)],
            "neutral": [[word, count] for word, count in word_counts["neutral"].most_common(50)],
            "negative": [[word, count] for word, count in word_counts["negative"].most_common(50)]
        }

        return result

    except Exception as e:
        print(f"Error generating wordcloud: {e}")
        return {"error": str(e)}


@app.get("/api/ngrams")
async def get_ngrams(start_date: str = None, end_date: str = None, source: str = None, n: int = 2):
    try:
        csv_path = os.path.join("static", "data_dashboard_final.csv")
        
        if not os.path.exists(csv_path):
            return {"error": "CSV file not found", "data": None}

        ngram_counts = {
            "positive": Counter(),
            "neutral": Counter(),
            "negative": Counter()
        }

        with open(csv_path, mode='r', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                try:
                    if source and source != "All" and row.get("sumber") != source:
                        continue

                    if start_date and end_date:
                        row_date_str = row.get("created_at", "").split(" ")[0]
                        if not row_date_str:
                            continue
                        
                        row_date = datetime.strptime(row_date_str, "%Y-%m-%d")
                        start = datetime.strptime(start_date, "%Y-%m-%d")
                        end = datetime.strptime(end_date, "%Y-%m-%d")

                        if not (start <= row_date <= end):
                            continue

                    text = row.get("text_stopwords", "")
                    label = float(row.get("label_code", -1))
                    
                    text = re.sub(r'[^\w\s]', '', text).lower()
                    words = text.split()
                    
                    if len(words) < n:
                        continue
                        
                    # Generate N-grams manually to avoid extra dependencies
                    row_ngrams = [" ".join(words[i:i+n]) for i in range(len(words)-n+1)]
                    
                    if label == 1.0:
                        ngram_counts["positive"].update(row_ngrams)
                    elif label == 0.0:
                        ngram_counts["neutral"].update(row_ngrams)
                    elif label == 2.0:
                        ngram_counts["negative"].update(row_ngrams)
                        
                except ValueError:
                    continue

        result = {
            "positive": [{"ngram": ngram, "count": count} for ngram, count in ngram_counts["positive"].most_common(50)],
            "neutral": [{"ngram": ngram, "count": count} for ngram, count in ngram_counts["neutral"].most_common(50)],
            "negative": [{"ngram": ngram, "count": count} for ngram, count in ngram_counts["negative"].most_common(50)]
        }

        return result

    except Exception as e:
        print(f"Error generating ngrams: {e}")
        return {"error": str(e)}

@app.get("/api/samples")
async def get_samples(query: str, n: int = 1, start_date: str = None, end_date: str = None, source: str = None, sentiment: float = None):
    try:
        csv_path = os.path.join("static", "data_dashboard_final.csv")
        
        if not os.path.exists(csv_path):
            return {"error": "CSV file not found", "samples": []}

        samples = []
        cleaned_query = re.sub(r'[^\w\s]', '', query).lower()

        with open(csv_path, mode='r', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                try:
                    # 1. Filters
                    if source and source != "All" and row.get("sumber") != source:
                        continue
                    
                    if sentiment is not None:
                         # Allow for some float tolerance or exact match
                         row_label = float(row.get("label_code", -1))
                         if row_label != sentiment:
                             continue

                    if start_date and end_date:
                        row_date_str = row.get("created_at", "").split(" ")[0]
                        if not row_date_str:
                            continue
                        
                        row_date = datetime.strptime(row_date_str, "%Y-%m-%d")
                        start = datetime.strptime(start_date, "%Y-%m-%d")
                        end = datetime.strptime(end_date, "%Y-%m-%d")

                        if not (start <= row_date <= end):
                            continue

                    # 2. Search Logic
                    text_stopwords = row.get("text_stopwords", "")
                    cleaned_text = re.sub(r'[^\w\s]', '', text_stopwords).lower()
                    
                    if cleaned_query in cleaned_text:
                        samples.append({
                            "username": row.get("username", "Anonymous"),
                            "text": row.get("text", ""), # Return original text for display
                            "date": row.get("created_at", "").split(" ")[0],
                            "source": row.get("sumber", "Unknown"),
                            "sentiment": float(row.get("label_code", -1))
                        })
                            
                except ValueError:
                    continue
        
        # Randomize and limit to 10
        if len(samples) > 10:
            samples = random.sample(samples, 10)

        return {"samples": samples}

    except Exception as e:
        print(f"Error fetching samples: {e}")
        return {"error": str(e), "samples": []}

app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
