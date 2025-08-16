import pytest
from wolfr import create_app

@pytest.fixture
def client():
   app = create_app({'TESTING': True})
   return app.test_client()

def test_form_submission(client):
   response = client.post('/formSubmission', data={'username': 'test', 'password': 'pass'})
   assert response.status_code == 200
   assert response.get_json()['message'] == 'Received'