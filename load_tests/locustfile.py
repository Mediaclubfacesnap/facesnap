from locust import HttpUser, task, between

class FaceSnapUser(HttpUser):
    wait_time = between(1, 5)

    @task(3)
    def view_communities(self):
        self.client.get("/api/v1/communities")

    @task(1)
    def view_health(self):
        self.client.get("/api/v1/health")
