import asyncio
import asyncpg
import datetime

async def main():
    print("Connecting to database...")
    conn = await asyncpg.connect('postgresql://postgres:Mediaclubfacesnap@[2406:da18:e5c:b700:2027:c108:315d:ae41]:5432/postgres')
    
    # 1. Delete existing verification sessions
    await conn.execute('DELETE FROM verification_sessions')
    print("Cleared existing verification sessions.")
    
    # 2. Define the new realistic records
    # User IDs:
    # nagendar (@nani): 9c41db3d-bcac-47e6-8fbb-434f76aa3fb9
    # sai (@sai): f3d9f131-fbf3-456f-a4f1-78aa6725c785
    # Event ID: f4c9db45-f0ff-4258-aa6d-927140ad8368
    
    now = datetime.datetime.now(datetime.timezone.utc)
    
    records = [
        # Record 1: @sai High Confidence Match, 2 mins ago
        {
            'user_id': 'f3d9f131-fbf3-456f-a4f1-78aa6725c785',
            'event_id': 'f4c9db45-f0ff-4258-aa6d-927140ad8368',
            'status': 'verified',
            'liveness_score': 0.985,
            'matched_photos_count': 3,
            'average_confidence': 0.9452,
            'processing_time_ms': 342,
            'ip_address': '122.172.84.112',
            'device_info': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'created_at': now - datetime.timedelta(minutes=2)
        },
        # Record 2: @nani Liveness/Anti-spoofing failure, 15 mins ago
        {
            'user_id': '9c41db3d-bcac-47e6-8fbb-434f76aa3fb9',
            'event_id': 'f4c9db45-f0ff-4258-aa6d-927140ad8368',
            'status': 'failed',
            'liveness_score': 0.243,
            'matched_photos_count': 0,
            'average_confidence': 0.0,
            'processing_time_ms': 215,
            'ip_address': '106.51.242.18',
            'device_info': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
            'created_at': now - datetime.timedelta(minutes=15)
        },
        # Record 3: @sai No Match, 1 hour ago
        {
            'user_id': 'f3d9f131-fbf3-456f-a4f1-78aa6725c785',
            'event_id': 'f4c9db45-f0ff-4258-aa6d-927140ad8368',
            'status': 'verified',
            'liveness_score': 0.952,
            'matched_photos_count': 0,
            'average_confidence': 0.0,
            'processing_time_ms': 412,
            'ip_address': '122.172.84.112',
            'device_info': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'created_at': now - datetime.timedelta(hours=1)
        },
        # Record 4: @nani High Confidence Match, 3 hours ago
        {
            'user_id': '9c41db3d-bcac-47e6-8fbb-434f76aa3fb9',
            'event_id': 'f4c9db45-f0ff-4258-aa6d-927140ad8368',
            'status': 'verified',
            'liveness_score': 0.991,
            'matched_photos_count': 7,
            'average_confidence': 0.8874,
            'processing_time_ms': 520,
            'ip_address': '106.51.242.18',
            'device_info': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'created_at': now - datetime.timedelta(hours=3)
        },
        # Record 5: @sai Medium Confidence Match, 5 hours ago
        {
            'user_id': 'f3d9f131-fbf3-456f-a4f1-78aa6725c785',
            'event_id': 'f4c9db45-f0ff-4258-aa6d-927140ad8368',
            'status': 'verified',
            'liveness_score': 0.978,
            'matched_photos_count': 2,
            'average_confidence': 0.7425,
            'processing_time_ms': 380,
            'ip_address': '122.172.84.112',
            'device_info': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'created_at': now - datetime.timedelta(hours=5)
        }
    ]
    
    for r in records:
        await conn.execute("""
            INSERT INTO verification_sessions (
                user_id, event_id, status, liveness_score, matched_photos_count, 
                average_confidence, processing_time_ms, ip_address, device_info, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        """, r['user_id'], r['event_id'], r['status'], r['liveness_score'], r['matched_photos_count'],
               r['average_confidence'], r['processing_time_ms'], r['ip_address'], r['device_info'], r['created_at'])
        
    print("Successfully inserted 5 beautiful, realistic AI Recognition history records!")
    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
