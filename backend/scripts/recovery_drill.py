import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.workers.recovery_tasks import trigger_backup_job, run_restore_test_job, redis_rebuild_job

async def perform_recovery_drill():
    print("🚨 Starting Disaster Recovery Drill...")
    
    print("1. Triggering full database backup...")
    try:
        backup_id = await trigger_backup_job("manual_drill")
        print(f"✅ Backup job queued. (ID: {backup_id})")
    except Exception as e:
        print(f"❌ Backup failed: {e}")
        
    print("2. Triggering cache rebuild...")
    try:
        rebuild_id = await redis_rebuild_job()
        print(f"✅ Redis rebuild job queued. (ID: {rebuild_id})")
    except Exception as e:
        print(f"❌ Cache rebuild failed: {e}")
        
    print("3. Validating restore test job...")
    try:
        restore_id = await run_restore_test_job()
        print(f"✅ Restore validation queued. (ID: {restore_id})")
    except Exception as e:
        print(f"❌ Restore test failed: {e}")
        
    print("🏁 Recovery drill initiated.")

if __name__ == "__main__":
    asyncio.run(perform_recovery_drill())
