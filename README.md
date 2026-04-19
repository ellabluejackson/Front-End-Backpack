# Front-End-Backpack

Frontend for My Digital Backpack. Plain HTML/CSS/JS, no build step.

## How to run the full app (frontend + backend)

1. **Start the backend API (FastAPI)**
   - Open a terminal and run:
     ```bash
     cd /Users/ellabluejackson/Desktop/Integration/Backend-Backpack
     pip install -r files/requirements.txt   # or pip3 install ...
     uvicorn files.main:app --reload
     ```
   - Leave this terminal running.  
   - The API will be available at `http://127.0.0.1:8000` (same as `http://localhost:8000`).

2. **Start the frontend**
   - Open a second terminal and run:
     ```bash
     cd /Users/ellabluejackson/Desktop/Integration/Front-End-Backpack/Front-End-Backpack
     python3 -m http.server 5500
     ```
   - Leave this terminal running as well.

3. **Use the app**
   - In your browser, go to: `http://localhost:5500`
   - The frontend will talk to the backend at `http://localhost:8000` for:
     - folders / notebooks / flashcards (Backpack page)
     - todos (To Do page)

If you change backend code, restart the `uvicorn` process. If you change frontend files, just refresh the browser.