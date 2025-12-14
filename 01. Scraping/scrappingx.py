import asyncio
from twikit import Client
import pandas as pd
import time

# --- KONFIGURASI ---
AUTH_TOKEN = ''
CT0 = ''

TWEET_PER_BULAN = 300

TARGET_BULAN = [
    # ('2025-01-01', '2025-01-30'),
    # ('2025-02-01', '2025-02-28'),
    # ('2025-03-01', '2025-03-30'),
    # ('2025-04-01', '2025-04-30'),
    # ('2025-05-01', '2025-05-30'),
    # ('2025-06-01', '2025-06-30'),
    ('2025-07-01', '2025-07-30'),
    # ('2025-08-01', '2025-08-30'),
    # ('2025-09-01', '2025-09-30'),
    # ('2025-10-01', '2025-10-31'),
    # ('2025-11-01', '2025-11-30')
]

client = Client('en-US')

async def main():
    print("Sedang mengatur cookies...")
    try:
        client.set_cookies(cookies={"auth_token": AUTH_TOKEN, "ct0": CT0})
        print("Login sukses!")
    except Exception as e:
        print(f"Error login: {e}")
        return

    all_tweets_data = []

    # --- LOOPING SETIAP BULAN ---
    for start_date, end_date in TARGET_BULAN:
        print(f"\n--- Mengambil data periode: {start_date} s.d. {end_date} ---")
        
        base_query = '(bitcoin OR btc OR long OR short OR liquid OR likuidasi OR "margin call") (bitcoin OR btc OR nangis OR stress OR rungkad OR "kena mental") lang:id -filter:links -filter:replies'
        query = f'{base_query} since:{start_date} until:{end_date}'
        
        tweets_list_bulan_ini = []
        
        try:
            tweets = await client.search_tweet(query, product='Latest', count=20)
        except Exception as e:
            print(f"Gagal search di bulan ini: {e}")
            continue

        while len(tweets_list_bulan_ini) < TWEET_PER_BULAN:
            if not tweets:
                break
            
            for tweet in tweets:
                data = {
                    'username': tweet.user.name,
                    'text': tweet.text,
                    'created_at': tweet.created_at,
                    'likes': tweet.favorite_count,
                    'retweets': tweet.retweet_count
                }
                tweets_list_bulan_ini.append(data)
            
            print(f"Dapat {len(tweets_list_bulan_ini)} tweet untuk periode ini...")

            if len(tweets_list_bulan_ini) < TWEET_PER_BULAN:
                time.sleep(5) # Jeda aman
                tweets = await tweets.next()
        
        all_tweets_data.extend(tweets_list_bulan_ini)
        print(f"Selesai bulan {start_date}. Total sementara: {len(all_tweets_data)} data.")
        
        time.sleep(10)

    df = pd.DataFrame(all_tweets_data)
    df.to_csv('data_crypto_new_per_bulan_jul.csv', index=False)
    print(f"SELESAI! Total {len(df)} data tersimpan di 'data_crypto_new_per_bulan_jul.csv'")

asyncio.run(main())