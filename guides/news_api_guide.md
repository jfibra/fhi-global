# Global News Integration Guide

This document outlines the architecture and implementation for integrating the News API into your platform using a secure proxy service.

## 🏗️ Architecture Overview

To maintain security and prevent API key exposure in the frontend, we use a **Proxy Pattern**:

`[Static Site / Frontend]` ➔ `[Secure Proxy Service (Backend)]` ➔ `[HomesPh News API]`

1.  **Frontend**: Makes a request to your internal proxy endpoint (e.g., `/api/v1/news/articles`).
2.  **Proxy Service**: Receives the request, injects the secure `X-Site-Api-Key` from the environment, and forwards the request to the HomesPh News API.
3.  **HomesPh News API**: Returns the data to the proxy, which then passes it back to the frontend.

---

## 🔑 API Key Configuration

The API Key should **NEVER** be stored in the frontend or hardcoded in client-side code.

### Backend Configuration (`.env`)
Store the key in your server's environment variables. You can find your site's specific key in the **HomesPh Admin Dashboard > Sites Management**.

\`\`\`env
HOMESPH_NEWS_API_URL=http://your-news-server.com
HOMESPH_NEWS_API_KEY=your_api_key
\`\`\`

---

## 🛠️ Backend Implementation Examples

The backend acts as a bridge. The logic is the same in every language: **Receive request ➔ Inject Header ➔ Forward to HomesPh.**

### Example: Python (FastAPI)
\`\`\`python
@router.get("/api/v1/news/articles")
async def proxy_news_articles(page: int = 1):
    url = f"{HOMESPH_NEWS_API_URL}/api/external/articles"
    async with httpx.AsyncClient() as client:
        headers = {"X-Site-Api-Key": HOMESPH_NEWS_API_KEY, "Accept": "application/json"}
        response = await client.get(url, params={"page": page}, headers=headers)
        return response.json()
\`\`\`

### Example: PHP (Vanilla / cURL)
\`\`\`php
<?php
$url = "http://your-news-server.com/api/external/articles?page=1";
$apiKey = "your_api_key_here";

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "X-Site-Api-Key: $apiKey",
    "Accept: application/json"
]);

$response = curl_exec($ch);
echo $response; // Return this to your frontend
curl_close($ch);
?>
\`\`\`

### Example: Laravel (Http Client)
\`\`\`php
use Illuminate\Support\Facades\Http;

Route::get('/api/v1/news/articles', function () {
    return Http::withHeaders([
        'X-Site-Api-Key' => env('HOMESPH_NEWS_API_KEY'),
        'Accept' => 'application/json',
    ])->get(env('HOMESPH_NEWS_API_URL') . '/api/external/articles', [
        'page' => request('page', 1)
    ])->json();
});
\`\`\`

### Example: C# (.NET / HttpClient)
\`\`\`csharp
public async Task<string> GetNews(int page = 1)
{
    var client = new HttpClient();
    client.DefaultRequestHeaders.Add("X-Site-Api-Key", "your_api_key_here");
    client.DefaultRequestHeaders.Add("Accept", "application/json");

    var response = await client.GetAsync($"http://your-news-server.com/api/external/articles?page={page}");
    return await response.Content.ReadAsStringAsync();
}
\`\`\`

---

## 💻 Frontend Implementation (Example: React/Vite)

The frontend calls **your own** proxy service, not the News API directly.

### Frontend Configuration (`.env`)
\`\`\`env
VITE_MY_BACKEND_URL=http://localhost:9500
\`\`\`

### Fetching Logic
\`\`\`typescript
const fetchNews = async () => {
    try {
        const backendUrl = import.meta.env.VITE_MY_BACKEND_URL;
        
        // Call your own backend proxy. No API key exposed here.
        const response = await fetch(`${backendUrl}/api/v1/news/articles`);
        
        if (!response.ok) throw new Error('Failed to fetch from proxy');
        
        const result = await response.json();
        
        // Response Structure:
        // result.site -> Info about your site
        // result.data.data -> The actual array of articles
        return result.data.data; 
    } catch (error) {
        console.error("News Fetch Error:", error);
    }
};
\`\`\`

---

## 🛡️ Security Benefits

1.  **No Key Exposure**: Browser users cannot see your `X-Site-Api-Key` in the Network tab.
2.  **Domain Locking**: The News API only accepts requests from your registered domain in production, adding a second layer of safety.
3.  **Clean JSON**: Your proxy gives you exactly the data you need for your frontend.
