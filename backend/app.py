from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import numpy as np
import faiss
import pickle
import google.generativeai as genai
from sentence_transformers import SentenceTransformer
import time
from PIL import Image
import PyPDF2
import pytesseract
import uuid
from typing import Dict, List, Optional
import serpapi
import json
app = Flask(__name__)
CORS(app)

# Set up Gemini API
genai.configure(api_key="AIzaSyAqJm2rKndj-4M9ZyME0PrWGuJsxWrUzyE")
model = genai.GenerativeModel('gemini-2.0-flash-exp')
model2 = genai.GenerativeModel("gemini-1.5-flash-8b")
model_3 = genai.GenerativeModel('gemini-2.0-flash-exp')
model_4 = genai.GenerativeModel('gemini-2.0-flash-exp')

# Initialize chat session
chat_session = model.start_chat(history=[])
chat_session2 = model_3.start_chat(history=[])
chat_session3 = model_4.start_chat(history=[])
SERPAPI_API_KEY = "80a9444aa191c308b0b98c4cb56395f4caa6f4c8439610f0135a9145f85ccd56"
# Load RAG components
save_dir = "rag_components"
embeddings = np.load(os.path.join(save_dir, 'embeddings.npy'))
index = faiss.read_index(os.path.join(save_dir, 'faiss_index.index'))
with open(os.path.join(save_dir, 'chunks.pkl'), 'rb') as f:
    chunks = pickle.load(f)
embedding_model = SentenceTransformer(os.path.join(save_dir, 'embedding_model'))

# In-memory storage for cases
cases = []

        
def retrieve_relevant_chunks(query, top_k=3):
    query_embedding = embedding_model.encode(query, convert_to_tensor=True).numpy()
    query_embedding = np.expand_dims(query_embedding, axis=0)
    distances, indices = index.search(query_embedding, top_k)
    relevant_chunks = [chunks[i] for i in indices[0]]
    return relevant_chunks

def get_domain_classification(query: str) -> str:
    try:
        domain_response = model2.generate_content(
            f"""Classify this legal query: '{query}'. Choose from: Criminal Law, Civil Law, "
            "Constitutional Law, Corporate Law, Intellectual Property Law, Environmental Law, "
            "International Law, Tax Law, Family Law, Cyber Law. If more than one domain is involved, you may choose them and use commas, e.g., "
            "Civil Law, Environmental Law, etc. **Output only the chosen domain**."""
        ).text.strip()
        return domain_response
    except Exception as e:
        print(f"Error in domain classification: {e}")
        return "Legal"

def should_search(query, history):
    """Determine if online search is needed - returns boolean only."""
    prompt = f"""
    Analyze this query in context of this conversation history:
    {json.dumps(history[-3:], indent=2)}
    
    Current query: "{query}"
    
    Should we search online? Answer ONLY 'true' or 'false'.
    Consider:
    1. Is this asking for real-time/current information?
    2. Is this a follow-up question that can be answered from context?
    3. Is the answer likely in the model's training data?
    """
    
    try:
        response = chat_session2.send_message(prompt)
        return response.text.strip().lower() == 'true'
    except Exception:
        return True  # Default to search if there's any error

def decompose_query(query, history):
    """Break down query into searchable sub-queries with context."""
    prompt = f"""
    Conversation context:
    {json.dumps(history[-2:], indent=2)}
    
    Based on: "{query}"
    Generate 3-5 specific Google search queries to answer it fully.
    Return ONLY a JSON list like: ["query 1", "query 2"]
    """
    
    try:
        response = chat_session2.send_message(prompt)
        cleaned = response.text.strip().strip('```json').strip('```').strip()
        return json.loads(cleaned)
    except Exception:
        return [f"{query} 2023 OR 2024", f"Recent changes to {query}"]

def execute_searches(queries):
    """Run searches and collect results."""
    context = []
    sources = []
    
    for query in queries:
        try:
            client = serpapi.Client(api_key=SERPAPI_API_KEY)
            results = client.search({"q": query, "hl": "en", "gl": "us", "num": 3})
            
            query_sources = []
            if "answer_box" in results and "snippet" in results["answer_box"]:
                if "link" in results["answer_box"]:
                    query_sources.append({
                        "text": results["answer_box"]["snippet"],
                        "url": results["answer_box"]["link"],
                        "query": query
                    })

            for result in results.get("organic_results", []):
                if "snippet" in result and "link" in result:
                    query_sources.append({
                        "text": result["snippet"],
                        "url": result["link"],
                        "query": query
                    })

            if query_sources:
                context.append("\n".join(f"- {s['text']}" for s in query_sources))
                sources.extend(query_sources)
                
        except Exception:
            continue
    
    return context, sources

def generate_search_answer(query, context, sources, history):
    """Generate answer from search results with chat context."""
    prompt = f"""
    Conversation history for context:
    {json.dumps(history[-3:], indent=2)}
    
    Search results:
    {''.join(context)}
    
    Answer this query while maintaining conversation flow:
    "{query}"
    """
    response = chat_session2.send_message(prompt)
    return response.text, sources
   
def generate_chatbot_response(query: str, relevant_chunks: List[str]) -> str:
    context = "\n".join(relevant_chunks)
    prompt = f"""As a legal chatbot, provide a concise and informative response to the following query based on the given context:
    Query: {query}
    
    Context from legal documents:
    {context}
    
    Please provide a clear and helpful response, addressing the user's question directly."""

    response = chat_session.send_message(prompt)
    return response.text

def generate_research_response(query: str) -> str:
    chat_history = []               
    chat_history.append({"role": "user", "content": query})
    
    # Get boolean decision about searching
    needs_search = should_search(query, chat_history)
    
    if needs_search:
        queries = decompose_query(query, chat_history)
        context, sources = execute_searches(queries)
        
        if not sources:
            response = chat_session2.send_message(query)
            chat_history.append({"role": "model", "content": response.text})
            return response.text
            
        answer, sources = generate_search_answer(query, context, sources, chat_history)
        chat_history.append({"role": "model", "content": answer})
        
        # Format the response with sources
        formatted_response = f"{answer}\n\nSources:\n"
        for i, source in enumerate(sources[:3], 1):
            formatted_response += f"{i}. {source['url']}\n"
            formatted_response += f"   Excerpt: {source['text'][:100]}...\n\n"
        
        return formatted_response.strip()
    else:
        response = chat_session2.send_message(query)
        return response.text

def generate_draft_editor_response(query: str) -> str:
    prompt = f"""As a legal document drafter, create a draft legal notice based on the following requirements:
    Requirements just give the legal draft without any other text for : {query}
    
    Please provide:
    1. A properly formatted legal notice
    2. Clear and concise language
    3. Necessary legal clauses and statements

    Ensure the draft is professional and adheres to standard legal writing practices."""

    response = chat_session3.send_message(prompt)
    return response.text
    return response.text
def extract_text_from_file(file):
    file_type = file.filename.split('.')[-1].lower()
    if file_type in ['txt', 'text']:
        return file.read().decode('utf-8')
    elif file_type == 'pdf':
        reader = PyPDF2.PdfReader(file)
        text = ""
        for page in reader.pages:
            text += page.extract_text()
        return text
    elif file_type in ['jpg', 'jpeg', 'png']:
        image = Image.open(file)
        return pytesseract.image_to_string(image)
    else:
        raise ValueError("Unsupported file type.")

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.form
    query = data.get('message', '')
    mode = data.get('mode', 'chatbot')
    file = request.files.get('file')
    file_content = ''
    if file:
        file_content = extract_text_from_file(file)
    full_query = query + "\n\n" + file_content if file_content else query

    start_time = time.time()
    domain = get_domain_classification(full_query)

    try:
        if mode == 'chatbot':
            relevant_chunks = retrieve_relevant_chunks(full_query)
            response = generate_chatbot_response(full_query, relevant_chunks)
        elif mode == 'research':
            response = generate_research_response(full_query)
        elif mode == 'draft':
            response = generate_draft_editor_response(full_query)
        else:
            return jsonify({"error": "Invalid mode specified"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    response_time = time.time() - start_time

    return jsonify({
        "response": response,
        "domain": domain,
        "mode": mode,
        "response_time": response_time
    })

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    try:
        file_content = extract_text_from_file(file)
        return jsonify({"file_content": file_content})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/case', methods=['POST'])
def create_case():
    case_id = str(uuid.uuid4())
    new_case = {
        'id': case_id,
        'name': f"Case #{len(cases) + 1}",
        'chats': []
    }
    cases.append(new_case)
    return jsonify(new_case)

@app.route('/api/case/<case_id>/chat', methods=['POST'])
def create_chat(case_id):
    case = next((c for c in cases if c['id'] == case_id), None)
    if not case:
        return jsonify({"error": "Case not found"}), 404
    
    data = request.json
    chat_type = data.get('type', 'chat')
    chat_id = str(uuid.uuid4())
    new_chat = {
        'id': chat_id,
        'name': f"{chat_type.capitalize()} {len(case['chats']) + 1}",
        'type': chat_type,
        'messages': []
    }
    case['chats'].append(new_chat)
    return jsonify(new_chat)

@app.route('/api/case/<case_id>/clear', methods=['DELETE'])
def clear_case(case_id):
    case = next((c for c in cases if c['id'] == case_id), None)
    if not case:
        return jsonify({"error": "Case not found"}), 404
    
    case['chats'] = []
    return jsonify({"message": "Case cleared successfully"})

@app.route('/api/cases', methods=['GET'])
def get_cases():
    return jsonify(cases)

if __name__ == '__main__':
    app.run(debug=True) 

