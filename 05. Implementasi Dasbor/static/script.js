let tweetInterval;
let isPaused = false;
let sentimentChart = null;
let barChartPositive = null;
let barChartNeutral = null;
let barChartNegative = null;
let ngramChartPositive = null;
let ngramChartNeutral = null;
let ngramChartNegative = null;

document.addEventListener('DOMContentLoaded', () => {
    loadSentimentData();
    fetchTweets();
    setupTweetUpdates();
    fetchTopCoins();
    setupNewsControls();
    fetchNews();
    setupAirdropControls();
    fetchAirdrops(0);
    setupUnlockControls();
    fetchUnlocks(0);
    setupArticleControls();
    fetchArticles(1);

    fetchNGrams();
    setupFilterControls();
    
    setInterval(fetchTopCoins, 60000);
});

function setupFilterControls() {
    const applyBtn = document.getElementById('applyFilterBtn');
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            const source = document.getElementById('sourceFilter').value;

            const filters = {
                start_date: startDate,
                end_date: endDate,
                source: source
            };

            loadSentimentData(filters);

            fetchNGrams(filters);
        });
    }


    const ngramSizeInput = document.getElementById('ngramSize');
    if (ngramSizeInput) {
        ngramSizeInput.addEventListener('change', () => {
             // Validation: N > 0 and integer
             let n = parseInt(ngramSizeInput.value);
             if (isNaN(n) || n < 1) {
                 n = 1;
                 ngramSizeInput.value = 1;
             }
             
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            const source = document.getElementById('sourceFilter').value;

            const filters = {
                start_date: startDate,
                end_date: endDate,
                source: source
            };

            fetchNGrams(filters);
        });
    }
}


// Token Unlock Logic
let currentUnlockPage = 0;
const unlockPageSize = 9;

function setupUnlockControls() {
    const prevBtn = document.getElementById('prevUnlockBtn');
    const nextBtn = document.getElementById('nextUnlockBtn');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentUnlockPage > 0) {
                fetchUnlocks(currentUnlockPage - 1);
            }
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            fetchUnlocks(currentUnlockPage + 1);
        });
    }
}

async function fetchUnlocks(page) {
    console.log('Fetching unlocks page:', page);
    const container = document.getElementById('unlockContainer');
    const prevBtn = document.getElementById('prevUnlockBtn');
    const nextBtn = document.getElementById('nextUnlockBtn');
    const pageIndicator = document.getElementById('unlockPageIndicator');
    
    if (!container) return;

    if (container.innerHTML.trim() === '' || container.querySelector('.loading-text')) {
        container.innerHTML = '<div class="loading-text">Loading Token Unlocks...</div>';
    }
    
    try {
        const response = await fetch(`/api/unlocks?page=${page}&size=${unlockPageSize}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Unlock data received:', data);
        
        const content = data.markets && data.markets.content ? data.markets.content : [];
        
        if (content && Array.isArray(content) && content.length > 0) {
            renderUnlocks(content);
            
            // Update pagination controls
            currentUnlockPage = page;
            if (pageIndicator) pageIndicator.innerText = `Page ${currentUnlockPage + 1}`;
            if (prevBtn) prevBtn.disabled = currentUnlockPage === 0;
            
            // Check if we reached the end (simplified check)
            if (nextBtn) nextBtn.disabled = content.length < unlockPageSize;
        } else {
            container.innerHTML = '<div class="loading-text">No token unlocks found.</div>';
        }
    } catch (error) {
        console.error('Error fetching unlocks:', error);
        container.innerHTML = `<div class="loading-text">Failed to load unlocks: ${error.message}</div>`;
    }
}

// News Logic
let currentNewsPage = 1;
const newsPageSize = 6;
let allNewsData = [];

function setupNewsControls() {
    const prevBtn = document.getElementById('prevNewsBtn');
    const nextBtn = document.getElementById('nextNewsBtn');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentNewsPage > 1) {
                currentNewsPage--;
                renderNewsPage();
            }
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(allNewsData.length / newsPageSize);
            if (currentNewsPage < totalPages) {
                currentNewsPage++;
                renderNewsPage();
            }
        });
    }
}

async function fetchNews() {
    const container = document.getElementById('newsContainer');
    if (!container) return;
    
    // Only show loading if we don't have data yet
    if (allNewsData.length === 0) {
        container.innerHTML = '<div class="loading-text">Loading News...</div>';
    }
    
    try {
        const response = await fetch('/api/news');
        const data = await response.json();
        
        if (data.Data && Array.isArray(data.Data)) {
            allNewsData = data.Data;
            renderNewsPage();
        } else {
            container.innerHTML = '<div class="loading-text">No news found.</div>';
        }
    } catch (error) {
        console.error('Error fetching news:', error);
        container.innerHTML = '<div class="loading-text">Failed to load news.</div>';
    }
}

function renderNewsPage() {
    const container = document.getElementById('newsContainer');
    const prevBtn = document.getElementById('prevNewsBtn');
    const nextBtn = document.getElementById('nextNewsBtn');
    const pageIndicator = document.getElementById('newsPageIndicator');
    
    if (!container) return;
    
    container.innerHTML = '';
    
    const start = (currentNewsPage - 1) * newsPageSize;
    const end = start + newsPageSize;
    const pageItems = allNewsData.slice(start, end);
    
    if (pageItems.length === 0) {
        container.innerHTML = '<div class="loading-text">No news found.</div>';
        return;
    }

    pageItems.forEach(item => {
        const card = document.createElement('a');
        card.className = 'airdrop-card article-card'; // Use article-card for consistent styling
        card.href = item.url;
        card.target = '_blank';
        card.style.textDecoration = 'none';
        
        const image = item.imageurl || 'https://via.placeholder.com/300x200';
        const title = item.title || 'No Title';
        const source = item.source_info?.name || 'Unknown Source';
        const date = new Date(item.published_on * 1000).toLocaleDateString();
        
        card.innerHTML = `
            <div class="airdrop-header" style="flex-direction: column; align-items: flex-start;">
                <img src="${image}" alt="${title}" class="article-cover" style="width: 100%; height: 160px; object-fit: cover; border-radius: 8px; margin-bottom: 12px; border: none;">
                <div class="airdrop-title-row" style="width: 100%;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span class="airdrop-status status-active">${source}</span>
                        <span style="font-size: 0.8rem; color: var(--text-secondary);">${date}</span>
                    </div>
                    <h3 class="airdrop-name" style="font-size: 1rem; line-height: 1.4; margin-bottom: 8px;">${title}</h3>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
    
    // Update pagination controls
    const totalPages = Math.ceil(allNewsData.length / newsPageSize);
    if (pageIndicator) pageIndicator.innerText = `Page ${currentNewsPage}`;
    if (prevBtn) prevBtn.disabled = currentNewsPage <= 1;
    if (nextBtn) nextBtn.disabled = currentNewsPage >= totalPages;
}

function renderUnlocks(unlocks) {
    const container = document.getElementById('unlockContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (unlocks.length === 0) {
        container.innerHTML = '<div class="loading-text">No token unlocks found.</div>';
        return;
    }

    unlocks.forEach(item => {
        const card = document.createElement('div');
        card.className = 'airdrop-card unlock-card'; // Reuse airdrop card styles
        
        const image = item.image || 'https://via.placeholder.com/50';
        const name = item.name || 'Unknown Token';
        const symbol = item.symbol || '';
        const price = item.price && item.price.USD ? `$${parseFloat(item.price.USD).toFixed(4)}` : 'N/A';
        
        // Unlock Data
        const vesting = item.fundraisingBaseData?.vesting?.totalUnlockProgress || {};
        const nextUnlock = vesting.nextUnlock || {};
        
        const unlockDate = nextUnlock.date ? new Date(nextUnlock.date).toLocaleDateString() : 'TBA';
        const daysUntil = nextUnlock.date ? Math.ceil((nextUnlock.date - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
        const unlockTokens = nextUnlock.tokens ? nextUnlock.tokens.toLocaleString(undefined, {maximumFractionDigits: 0}) : '0';
        const unlockUsd = nextUnlock.usdAmount ? `$${nextUnlock.usdAmount.toLocaleString(undefined, {maximumFractionDigits: 0})}` : '$0';
        const marketCapShare = nextUnlock.marketCapSharePercent ? nextUnlock.marketCapSharePercent.toFixed(2) + '%' : '0%';
        
        card.innerHTML = `
            <div class="airdrop-header">
                <img src="${image}" alt="${name}" class="airdrop-logo">
                <div class="airdrop-title-row">
                    <h3 class="airdrop-name">${name} <span class="airdrop-symbol">${symbol}</span></h3>
                    <span class="airdrop-status status-upcoming">in ${daysUntil} days</span>
                </div>
            </div>
            
            <div class="unlock-details">
                <div class="unlock-row">
                    <span class="label">Unlock Date</span>
                    <span class="value">${unlockDate}</span>
                </div>
                <div class="unlock-row">
                    <span class="label">Amount</span>
                    <span class="value highlight">${unlockTokens} ${symbol}</span>
                </div>
                <div class="unlock-row">
                    <span class="label">Value</span>
                    <span class="value">${unlockUsd}</span>
                </div>
                <div class="unlock-row">
                    <span class="label">% of M.Cap</span>
                    <span class="value warning">${marketCapShare}</span>
                </div>
            </div>
            
            <div class="price-tag">
                Current Price: ${price}
            </div>
        `;
        
        container.appendChild(card);
    });
}

// Articles Logic
let currentArticlePage = 1;
const articlePageSize = 6;

function setupArticleControls() {
    const prevBtn = document.getElementById('prevArticleBtn');
    const nextBtn = document.getElementById('nextArticleBtn');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentArticlePage > 1) {
                fetchArticles(currentArticlePage - 1);
            }
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            fetchArticles(currentArticlePage + 1);
        });
    }
}

async function fetchArticles(page) {
    console.log('Fetching articles page:', page);
    const container = document.getElementById('articleContainer');
    const prevBtn = document.getElementById('prevArticleBtn');
    const nextBtn = document.getElementById('nextArticleBtn');
    const pageIndicator = document.getElementById('articlePageIndicator');
    
    if (!container) return;

    if (container.innerHTML.trim() === '' || container.querySelector('.loading-text')) {
        container.innerHTML = '<div class="loading-text">Loading Articles...</div>';
    }
    
    try {
        const response = await fetch(`/api/articles?page=${page}&size=${articlePageSize}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Article data received:', data);
        
        const content = data.data || [];
        const meta = data.meta?.pagination || {};
        
        if (content && Array.isArray(content) && content.length > 0) {
            renderArticles(content);
            
            // Update pagination controls
            currentArticlePage = page;
            if (pageIndicator) pageIndicator.innerText = `Page ${currentArticlePage}`;
            if (prevBtn) prevBtn.disabled = currentArticlePage <= 1;
            
            // Check if we reached the end
            const totalPages = meta.pageCount || 1;
            if (nextBtn) nextBtn.disabled = currentArticlePage >= totalPages;
        } else {
            container.innerHTML = '<div class="loading-text">No articles found.</div>';
        }
    } catch (error) {
        console.error('Error fetching articles:', error);
        container.innerHTML = `<div class="loading-text">Failed to load articles: ${error.message}</div>`;
    }
}

function renderArticles(articles) {
    const container = document.getElementById('articleContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (articles.length === 0) {
        container.innerHTML = '<div class="loading-text">No articles found.</div>';
        return;
    }

    articles.forEach(item => {
        const card = document.createElement('a');
        card.className = 'airdrop-card article-card'; // Reuse airdrop card styles
        
        // Construct URL: https://dropstab.com/research/{category_key}/{slug}
        const categoryKey = item.category?.key || 'crypto';
        card.href = `https://dropstab.com/research/${categoryKey}/${item.slug}`;
        
        card.target = '_blank';
        card.style.textDecoration = 'none'; // Remove underline for link
        
        const cover = item.cover?.formats?.medium?.url || item.cover?.url || 'https://via.placeholder.com/300x200';
        const title = item.title || 'Untitled Article';
        const category = item.category?.name || 'General';
        const readTime = item.minutesToRead ? `${item.minutesToRead} min read` : '';
        const date = new Date(item.publishedAt).toLocaleDateString();
        const description = item.description || '';
        
        card.innerHTML = `
            <div class="airdrop-header" style="flex-direction: column; align-items: flex-start;">
                <img src="${cover}" alt="${title}" class="article-cover" style="width: 100%; height: 160px; object-fit: cover; border-radius: 8px; margin-bottom: 12px; border: none;">
                <div class="airdrop-title-row" style="width: 100%;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span class="airdrop-status status-active">${category}</span>
                        <span style="font-size: 0.8rem; color: var(--text-secondary);">${date}</span>
                    </div>
                    <h3 class="airdrop-name" style="font-size: 1rem; line-height: 1.4; margin-bottom: 8px;">${title}</h3>
                </div>
            </div>
            
            <p class="airdrop-desc" style="-webkit-line-clamp: 3;">${description}</p>
            
            <div class="airdrop-stats" style="margin-top: auto;">
                <div class="stat-item">
                    <i class="fas fa-clock"></i>
                    <span>${readTime}</span>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
}

async function fetchTweets() {
    if (isPaused) return;

    try {
        const response = await fetch('/api/tweets');
        const tweets = await response.json();
        
        renderTweets(tweets);
    } catch (error) {
        console.error('Error fetching tweets:', error);
    }
}

function renderTweets(tweets) {
    const container = document.getElementById('tweetsContainer');
    
    container.innerHTML = '';

    if (!tweets || !tweets.data || tweets.data.length === 0) {
        container.innerHTML = '<div class="loading-text">No tweets available</div>';
        return;
    }

    tweets.data.forEach(tweet => {
        const card = document.createElement('div');
        card.className = 'tweet-card';
        
        const user = tweet.user || {};
        const timeAgo = getTimeAgo(tweet.created_at);
        const content = tweet.text || tweet.full_text || "";

        const verified = tweet.user.verified ? `<svg viewBox="0 0 24 24" aria-label="Verified account" role="img" class="verified-svg"><g><path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z" fill="#1d9bf0"></path></g></svg>` : ``
        const protected = tweet.user.protected ? `<svg viewBox="0 0 24 24" aria-label="Verified account" role="img" class="protected-svg"><g><path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z" fill="#d18800"></path></g></svg>` : ``
        
        const replyIcon = `<svg viewBox="0 0 24 24"><path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z"></path></svg>`;
        const retweetIcon = `<svg viewBox="0 0 24 24"><path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"></path></svg>`;
        const likeIcon = `<svg viewBox="0 0 24 24"><path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"></path></svg>`;
        const shareIcon = `<svg viewBox="0 0 24 24"><path d="M12 2.59l5.7 5.7-1.41 1.42L13 6.41V16h-2V6.41l-3.3 3.3-1.41-1.42L12 2.59zM21 15l-.02 3.51c0 1.38-1.12 2.49-2.5 2.49H5.5C4.11 21 3 19.88 3 18.5V15h2v3.5c0 .28.22.5.5.5h12.98c.28 0 .5-.22.5-.5L19 15h2z"></path></svg>`;

        card.innerHTML = `
            <div class="tweet-header">
                <img src="${user.profile_image_url || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png'}" alt="Avatar" class="tweet-avatar">
                <div class="tweet-header-info">
                    <div class="tweet-user-row">
                        <span class="tweet-name">${user.name || 'Unknown'}</span>
                        <span class="verified">${(verified || protected) || ''}</span>
                        <span class="tweet-username">@${user.username || 'unknown'}</span>
                        <span class="tweet-separator">·</span>
                        <span class="tweet-time">${timeAgo}</span>
                    </div>
                    <!-- Optional: Reply Context could go here if data existed -->
                </div>
            </div>
            <div class="tweet-content">${content}</div>
            <div class="tweet-footer">
                <div class="tweet-action reply">
                    ${replyIcon}
                    <span>${tweet.public_metrics.reply_count || 0}</span>
                </div>
                <div class="tweet-action retweet">
                    ${retweetIcon}
                    <span>${tweet.public_metrics.retweet_count || 0}</span>
                </div>
                <div class="tweet-action like">
                    ${likeIcon}
                    <span>${tweet.public_metrics.like_count || 0}</span>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
}

function getTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return date.toLocaleDateString();
}

function setupTweetUpdates() {
    const tweetsCard = document.querySelector('.tweets-card');
    const statusIndicator = document.getElementById('tweetStatus');

    tweetInterval = setInterval(fetchTweets, 30000);

    tweetsCard.addEventListener('mouseenter', () => {
        isPaused = true;
        statusIndicator.textContent = 'PAUSED';
        statusIndicator.classList.add('paused');
    });

    tweetsCard.addEventListener('mouseleave', () => {
        isPaused = false;
        statusIndicator.textContent = 'LIVE';
        statusIndicator.classList.remove('paused');
    });
}

async function loadSentimentData(filters = {}) {
    try {
        let url = '/api/sentiment';
        const params = new URLSearchParams();
        if (filters.start_date) params.append('start_date', filters.start_date);
        if (filters.end_date) params.append('end_date', filters.end_date);
        if (filters.source) params.append('source', filters.source);
        
        if (params.toString()) url += `?${params.toString()}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            console.error('Error fetching sentiment:', data.error);
            document.getElementById('sentimentValue').innerText = 'Error';
            document.getElementById('sentimentLabel').innerText = 'Data Load Failed';
            return;
        }

        if (data.total === 0) {
            document.getElementById('sentimentValue').innerText = 'No Data';
            return;
        }

        document.getElementById('posCount').innerText = data.positive;
        document.getElementById('neuCount').innerText = data.neutral;
        document.getElementById('negCount').innerText = data.negative;

        document.getElementById('sentimentValue').innerText = data.score;
        document.getElementById('sentimentLabel').innerText = data.label;
        document.getElementById('sentimentLabel').style.color = data.color;

        updateGauge(data.score, data.color);

    } catch (error) {
        console.error('Error loading sentiment data:', error);
        document.getElementById('sentimentValue').innerText = 'Error';
        document.getElementById('sentimentLabel').innerText = 'Connection Failed';
    }
}

function updateGauge(score, color) {
    const ctx = document.getElementById('sentimentGauge').getContext('2d');
    
    if (sentimentChart) {
        sentimentChart.destroy();
    }

    sentimentChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Score', 'Remaining'],
            datasets: [{
                data: [score, 100 - score],
                backgroundColor: [
                    color,
                    'rgba(255, 255, 255, 0.1)'
                ],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '80%',
            rotation: -90,
            circumference: 180,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            }
        }
    });
}

async function fetchTopCoins() {
    try {
        const response = await fetch('/api/prices');
        const data = await response.json();
        
        renderCryptoMarquee(data);
    } catch (error) {
        console.error('Error fetching market data:', error);
        document.getElementById('cryptoMarquee').innerHTML = '<span class="loading-text">Failed to load market data.</span>';
    }
}

function renderCryptoMarquee(coins) {
    const container = document.getElementById('cryptoMarquee');
    container.innerHTML = '';

    let coinsHtml = '';
    coins.forEach(coin => {
        coinsHtml += `
            <div class="marquee-item">
                <span class="marquee-symbol">${coin.symbol}</span>
                <span class="marquee-price">$${coin.price.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </div>
        `;
    });

    container.innerHTML = coinsHtml + coinsHtml + coinsHtml + coinsHtml;
}

async function fetchNews() {
    try {
        const response = await fetch('/api/news');
        const data = await response.json();
        
        if (!Array.isArray(data.Data)) {
            throw new Error(data.Message || 'Invalid API response structure');
        }

        const newsItems = data.Data.slice(0, 6);
        renderNews(newsItems);
    } catch (error) {
        console.error('Error fetching news:', error);
        document.getElementById('newsContainer').innerHTML = `<div class="loading-text">Failed to load news: ${error.message}</div>`;
    }
}

function renderNews(newsItems) {
    const container = document.getElementById('newsContainer');
    container.innerHTML = '';

    newsItems.forEach(item => {
        const card = document.createElement('a');
        card.href = item.url;
        card.target = '_blank';
        card.className = 'news-card';
        
        const imageUrl = item.imageurl || 'https://via.placeholder.com/300x150?text=Crypto+News';
        
        const date = new Date(item.published_on * 1000).toLocaleDateString();

        card.innerHTML = `
            <img src="${imageUrl}" alt="News Image" class="news-image">
            <div class="news-title">${item.title}</div>
            <div class="news-meta">
                <span>${item.source_info.name}</span>
                <span>${date}</span>
            </div>
        `;
        
        container.appendChild(card);
    });
}

// Airdrop Logic
let currentAirdropPage = 0;
const airdropPageSize = 9;

function setupAirdropControls() {
    const prevBtn = document.getElementById('prevAirdropBtn');
    const nextBtn = document.getElementById('nextAirdropBtn');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentAirdropPage > 0) {
                fetchAirdrops(currentAirdropPage - 1);
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            fetchAirdrops(currentAirdropPage + 1);
        });
    }
}

async function fetchAirdrops(page) {
    console.log('Fetching airdrops page:', page);
    const container = document.getElementById('airdropContainer');
    const prevBtn = document.getElementById('prevAirdropBtn');
    const nextBtn = document.getElementById('nextAirdropBtn');
    const pageIndicator = document.getElementById('airdropPageIndicator');
    
    if (!container) return;

    // Only show loading on initial load or if container is empty
    if (container.innerHTML.trim() === '' || container.querySelector('.loading-text')) {
        container.innerHTML = '<div class="loading-text">Loading Airdrops...</div>';
    }
    
    try {
        const response = await fetch(`/api/airdrops?page=${page}&size=${airdropPageSize}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Airdrop data received:', data);
        
        // The API returns { activities: { content: [...] } }
        const content = data.activities && data.activities.content ? data.activities.content : [];
        
        if (content && Array.isArray(content) && content.length > 0) {
            renderAirdrops(content);
            
            // Update pagination controls
            currentAirdropPage = page;
            if (pageIndicator) pageIndicator.innerText = `Page ${currentAirdropPage + 1}`;
            if (prevBtn) prevBtn.disabled = currentAirdropPage === 0;
            
            // Check if we reached the end (simplified check)
            if (nextBtn) nextBtn.disabled = content.length < airdropPageSize;
        } else {
            container.innerHTML = '<div class="loading-text">No airdrops found.</div>';
        }
    } catch (error) {
        console.error('Error fetching airdrops:', error);
        container.innerHTML = `<div class="loading-text">Failed to load airdrops: ${error.message}</div>`;
    }
}

function renderAirdrops(airdrops) {
    const container = document.getElementById('airdropContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (airdrops.length === 0) {
        container.innerHTML = '<div class="loading-text">No airdrops found.</div>';
        return;
    }

    airdrops.forEach(item => {
        const card = document.createElement('div');
        card.className = 'airdrop-card';
        
        // Map fields from the API response
        const project = item.titleProject || {};
        const image = project.image || 'https://via.placeholder.com/50';
        const name = project.name || 'Unknown Project';
        const symbol = project.symbol || '';
        const status = item.status || 'Unknown';
        const description = item.about || 'No description available.';
        
        // New fields
        const fundsRaised = project.fundsRaised ? `$${(project.fundsRaised / 1000000).toFixed(1)}M` : 'N/A';
        const tweetScoutScore = project.tweetscoutScore || 'N/A';
        const tags = item.tags ? item.tags.map(t => t.name).join(', ') : '';
        const ecosystem = item.ecosystem ? item.ecosystem.map(e => e.displayName).join(', ') : '';
        const updatedAt = item.statusUpdatedAt ? new Date(item.statusUpdatedAt).toLocaleDateString() : 'N/A';

        // Format date
        let dateDisplay = '';
        if (item.activityFromCustom || item.activityToCustom) {
             const start = item.activityFromCustom || (item.activityFrom ? new Date(item.activityFrom).toLocaleDateString() : 'TBA');
             const end = item.activityToCustom || (item.activityTo ? new Date(item.activityTo).toLocaleDateString() : 'TBA');
             dateDisplay = `<div class="airdrop-date"><i class="far fa-calendar-alt"></i> ${start} - ${end}</div>`;
        } else if (item.startDate && item.endDate) {
            const start = new Date(item.startDate).toLocaleDateString();
            const end = new Date(item.endDate).toLocaleDateString();
            dateDisplay = `<div class="airdrop-date"><i class="far fa-calendar-alt"></i> ${start} - ${end}</div>`;
        }

        card.innerHTML = `
            <div class="airdrop-header">
                <img src="${image}" alt="${name}" class="airdrop-logo">
                <div class="airdrop-title-row">
                    <h3 class="airdrop-name">${name} <span class="airdrop-symbol">${symbol}</span></h3>
                    <span class="airdrop-status status-${status.toLowerCase()}">${status}</span>
                </div>
            </div>
            
            <div class="airdrop-stats">
                <div class="stat-item" title="Funds Raised">
                    <i class="fas fa-money-bill-wave"></i>
                    <span>${fundsRaised}</span>
                </div>
                <div class="stat-item" title="TweetScout Score">
                    <i class="fab fa-twitter"></i>
                    <span>${tweetScoutScore}</span>
                </div>
                <div class="stat-item" title="Last Updated">
                    <i class="fas fa-clock"></i>
                    <span>${updatedAt}</span>
                </div>
            </div>

            <div class="airdrop-tags">
                ${tags ? `<span class="tag"><i class="fas fa-tag"></i> ${tags}</span>` : ''}
                ${ecosystem ? `<span class="tag"><i class="fas fa-network-wired"></i> ${ecosystem}</span>` : ''}
            </div>

            <p class="airdrop-desc">${description}</p>
            ${dateDisplay}
        `;
        
        container.appendChild(card);
    });
}

async function fetchNGrams(filters = {}) {
    try {
        let url = '/api/ngrams';
        const params = new URLSearchParams();
        if (filters.start_date) params.append('start_date', filters.start_date);
        if (filters.end_date) params.append('end_date', filters.end_date);
        if (filters.source) params.append('source', filters.source);
        
        const ngramSize = document.getElementById('ngramSize').value || 2;
        params.append('n', ngramSize);
        
        if (params.toString()) url += `?${params.toString()}`;

        const response = await fetch(url);
        const data = await response.json();
        
        if (data.error) {
            console.error('Error fetching ngrams:', data.error);
            return;
        }

        renderNGramsAndCloud('ngram-positive', 'wordcloud-positive', data.positive, '#10b981', 'ngramChartPositive');
        renderNGramsAndCloud('ngram-neutral', 'wordcloud-neutral', data.neutral, '#f59e0b', 'ngramChartNeutral');
        renderNGramsAndCloud('ngram-negative', 'wordcloud-negative', data.negative, '#ef4444', 'ngramChartNegative');

    } catch (error) {
        console.error('Error loading ngrams:', error);
    }
}

function setupModalControls() {
    const modal = document.getElementById('sampleModal');
    const closeBtn = document.getElementById('closeModalBtn');
    
    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });

        // Close when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
        
        // Close on Esc key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                modal.classList.remove('active');
            }
        });
    }
}

// Call this in DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    setupModalControls();
});

async function openSampleModal(ngram, sentiment) {
    const modal = document.getElementById('sampleModal');
    const list = document.getElementById('sampleList');
    const title = document.getElementById('modalTitle');
    
    if (!modal || !list) return;
    
    // Reset and show loading
    list.innerHTML = '<div class="loading-text">Loading samples...</div>';
    title.innerText = `Samples for "${ngram}"`;
    modal.classList.add('active');

    try {
        // Construct query params
        const params = new URLSearchParams();
        params.append('query', ngram);
        
        // Add current filters
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const source = document.getElementById('sourceFilter').value;
        
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);
        if (source) params.append('source', source);
        
        // Map sentiment color/chart to label code if needed, 
        // but text search is primary. We can optionally filter by sentiment.
        // Sentiment mapping: Positive -> 1.0, Neutral -> 0.0, Negative -> 2.0
        let sentimentCode = null;
        if (sentiment === 'positive') sentimentCode = 1.0;
        else if (sentiment === 'neutral') sentimentCode = 0.0;
        else if (sentiment === 'negative') sentimentCode = 2.0;
        
        if (sentimentCode !== null) params.append('sentiment', sentimentCode);

        const response = await fetch(`/api/samples?${params.toString()}`);
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        if (!data.samples || data.samples.length === 0) {
            list.innerHTML = '<div class="loading-text">No samples found.</div>';
            return;
        }
        
        renderSamples(list, data.samples, ngram, sentiment);
        
    } catch (error) {
        console.error('Error fetching samples:', error);
        list.innerHTML = `<div class="loading-text">Error: ${error.message}</div>`;
    }
}

function renderSamples(container, samples, query, sentimentType) {
    container.innerHTML = '';
    
    samples.forEach(sample => {
        const card = document.createElement('div');
        card.className = `sample-card ${sentimentType}`; // Add sentiment class for border color
        
        // Highlight logic
        // We do a case-insensitive replace of the query words
        let highlightedText = sample.text;
        if (query) {
             const regex = new RegExp(`(${query})`, 'gi');
             highlightedText = highlightedText.replace(regex, '<span class="highlight-text">$1</span>');
        }
        
        const sourceIcon = sample.source === 'X' ? '<i class="fab fa-twitter"></i>' : 
                          (sample.source === 'Youtube' ? '<i class="fab fa-youtube"></i>' : '<i class="fas fa-bullhorn"></i>');
        
        card.innerHTML = `
            <div class="sample-header">
                <div class="sample-meta">
                    <span class="sample-username">${sample.username}</span>
                    <span class="sample-date">${sample.date}</span>
                </div>
                <div class="sample-source">
                    ${sourceIcon} <span>${sample.source}</span>
                </div>
            </div>
            <div class="sample-text">${highlightedText}</div>
        `;
        
        container.appendChild(card);
    });
}

function renderNGramsAndCloud(canvasId, cloudId, items, color, chartVarName) {
    // 1. Render Word Cloud
    const cloudElement = document.getElementById(cloudId);
    if (cloudElement && items && items.length > 0) {
        // Convert to format [[word, count], ...]
        const wordList = items.map(item => [item.ngram, item.count]);
        
        // Simple scaling
        const factor = items.length > 0 ? (50 / Math.max(items[0].count, 1)) : 1;

        WordCloud(cloudElement, {
            list: wordList,
            gridSize: 8,
            weightFactor: function (size) {
                 return Math.max(size * factor, 12); // Minimum font size 12
            },
            fontFamily: 'Outfit, sans-serif',
            color: function (word, weight) {
                return color;
            },
            rotateRatio: 0,
            backgroundColor: 'transparent',
            drawOutOfBound: false,
            shrinkToFit: true,
            // Add click handler for word cloud too if desired (optional)
            click: function(item) {
                 // item is [word, count]
                 // infer sentiment from chartVarName
                 let sentiment = 'neutral';
                 if (chartVarName.includes('Positive')) sentiment = 'positive';
                 else if (chartVarName.includes('Negative')) sentiment = 'negative';
                 
                 openSampleModal(item[0], sentiment);
            }
        });
    }

    // 2. Render Bar Chart (Top 10 only)
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    // Manage global chart instances
    if (window[chartVarName]) {
        window[chartVarName].destroy();
    }

    // Sort by count descending just in case
    items.sort((a, b) => b.count - a.count);
    
    const topItems = items.slice(0, 10); // Show only top 10 in bar chart
    
    const labels = topItems.map(item => item.ngram);
    const values = topItems.map(item => item.count);

    window[chartVarName] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Frequency',
                data: values,
                backgroundColor: color,
                borderRadius: 4,
                barThickness: 20
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            onClick: (e, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const label = labels[index];
                    
                    // Infer sentiment from variable name string
                    let sentiment = 'neutral';
                    if (chartVarName.includes('Positive')) sentiment = 'positive';
                    else if (chartVarName.includes('Negative')) sentiment = 'negative';
                    
                    openSampleModal(label, sentiment);
                }
            },
            onHover: (event, chartElement) => {
                event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
            },
             plugins: {
                legend: { display: false },
                title: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Frequency: ${context.raw}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { display: false },
                    ticks: { color: '#94a3b8', font: { family: 'Outfit' } }
                },
                y: {
                    grid: { display: false },
                    ticks: { 
                        color: '#64748b', 
                        font: { family: 'Outfit' },
                        autoSkip: false
                    }
                }
            }
        }
    });
}

