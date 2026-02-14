import streamlit as st
import plotly.graph_objects as go
import numpy as np
from openai import OpenAI
import json

# --- ELON CONFIG ---
st.set_page_config(page_title="NERVA: The Integrity Layer", layout="wide")

# --- THE MATH (The "Real" Part) ---
# We map the decision confidence (Thesis/Antithesis) to Quantum Coordinates
def calculate_bloch_vector(confidence_score, risk_score):
    # Map inputs (0-100) to Theta (Tilt) and Phi (Phase)
    # High Confidence = Up (North Pole)
    # High Risk = Rotation around the equator (Instability)
    
    theta = (1 - (confidence_score / 100)) * np.pi  # 0 is up, pi is down
    phi = (risk_score / 100) * 2 * np.pi            # Rotation
    
    # Spherical to Cartesian conversion (x, y, z)
    x = np.sin(theta) * np.cos(phi)
    y = np.sin(theta) * np.sin(phi)
    z = np.cos(theta)
    
    return x, y, z, theta, phi

# --- THE UI ---
st.title("NERVA v10: INTEGRITY PROTOCOL")
col1, col2 = st.columns([1, 2])

with col1:
    st.write("### INPUT VECTOR")
    api_key = st.text_input("OpenAI API Key", type="password")
    decision_input = st.text_area("The Dilemma", height=100, value="Should I invest $50k in a hardware startup?")
    
    if st.button("RUN QUANTUM ANALYSIS"):
        if not api_key:
            st.error("Need Keys.")
        else:
            client = OpenAI(api_key=api_key)
            
            # 1. THE DIALECTIC (Get the Data)
            with st.spinner("Processing Dialectics..."):
                response = client.chat.completions.create(
                    model="gpt-4",
                    messages=[
                        {"role": "system", "content": "You are NERVA. Analyze the decision. Return JSON: { 'thesis_strength': 0-100, 'antithesis_risk': 0-100, 'integrity_score': 0-100, 'synthesis': 'short text' }"},
                        {"role": "user", "content": decision_input}
                    ]
                )
                data = json.loads(response.choices[0].message.content)
                
                # 2. THE GEOMETRY (The Math)
                x, y, z, theta, phi = calculate_bloch_vector(data['thesis_strength'], data['antithesis_risk'])
                
                # Store state
                st.session_state['data'] = data
                st.session_state['coords'] = (x, y, z)

with col2:
    st.write("### THE BLOCH SPHERE (DECISION GEOMETRY)")
    
    # Default sphere
    if 'coords' not in st.session_state:
        x, y, z = 0, 0, 1 # Default UP
    else:
        x, y, z = st.session_state['coords']
        
    # Draw the Sphere
    u = np.linspace(0, 2 * np.pi, 100)
    v = np.linspace(0, np.pi, 100)
    sx = 1 * np.outer(np.cos(u), np.sin(v))
    sy = 1 * np.outer(np.sin(u), np.sin(v))
    sz = 1 * np.outer(np.ones(np.size(u)), np.cos(v))

    fig = go.Figure()

    # Wireframe Sphere
    fig.add_trace(go.Surface(x=sx, y=sy, z=sz, opacity=0.1, showscale=False, colorscale='Blues'))

    # The Decision Vector (The "Needle")
    fig.add_trace(go.Scatter3d(
        x=[0, x], y=[0, y], z=[0, z],
        mode='lines+markers',
        line=dict(color='red', width=10),
        marker=dict(size=5, color='red')
    ))

    # The "Integrity Horizon" (The equator)
    # If the vector drops below this, the decision is dangerous
    
    fig.update_layout(scene=dict(
        xaxis=dict(visible=False),
        yaxis=dict(visible=False),
        zaxis=dict(visible=False),
    ), margin=dict(l=0, r=0, b=0, t=0))

    st.plotly_chart(fig, use_container_width=True)

    if 'data' in st.session_state:
        d = st.session_state['data']
        st.metric("Integrity Score", f"{d['integrity_score']}%")
        st.info(f"SYNTHESIS: {d['synthesis']}")
        
        if d['integrity_score'] < 50:
            st.error("VECTOR SUB-OPTIMAL. DO NOT COMMIT.")
        else:
            st.success("VECTOR ALIGNED. EXECUTE.")
