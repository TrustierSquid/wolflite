import pytest
from wolfr import create_app

@pytest.fixture
def client():
   app = create_app({'TESTING': True})
   return app.test_client()

# FORMS

def test_form_create_user(client):
   response = client.post('/formSubmission', data={'username': 'test', 'password': 'pass'})
   assert response.status_code == 200

def test_form_login(client):
   response = client.post('/loginUser', data={'username': 'test', 'password': 'pass'})
   assert response.status_code == 200
