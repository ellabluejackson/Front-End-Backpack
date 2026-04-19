# Front-End-Backpack

Frontend for My Digital Backpack. Plain HTML/CSS/JS, no build step.

## How to run the full app (frontend + backend)

1. **Start the backend API (FastAPI)**
   - 
     pip install -r files/requirements.txt   # or pip3 install ...
     uvicorn files.main:app --reload
    
   - The API will be available at `http://127.0.0.1:8000` (same as `http://localhost:8000`).

2. **Start the frontend**
   - Open a second terminal and run:
     
     python3 -m http.server 5500

   - Leave this terminal running as well.

3. **Use the app**
   - browser, go to: `http://localhost:5500`
   - The frontend will talk to the backend at `http://localhost:8000` for:
     - folders / notebooks / flashcards (Backpack page)
     - todos (To Do page)
