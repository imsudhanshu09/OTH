import React, {useEffect} from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
} from "react-router-dom";
import './App.css';
import './index.css';
import Login from './Login.jsx'
import SignUp from "./SignUp.jsx"

function App() {
  useEffect(() => {
    // Create stars dynamically
    const container = document.querySelector('.background');
    const numStars = 100; // Adjust number of stars as needed
    for (let i = 0; i < numStars; i++) {
      const star = document.createElement('div');
      star.classList.add('star');
      star.style.top = `${Math.random() * 100}%`; // Randomize star position vertically
      star.style.left = `${Math.random() * 100}%`; // Randomize star position horizontally
      container.appendChild(star);
    }
  }, []);


  return(
      <Router>
        <div className="container">
          <nav className="navbar">
            <ul>
              <li>
                <Link to="/SignUp">★ Sign Up</Link>
              </li>
              <li>
                <Link to="/Login">★ Login</Link>
              </li>
            </ul>
          </nav>
          <div className="background"></div>
          <div className="sun"></div>
          <div className="welcome-message">
            <h1>Welcome to the <span>Online Treasure Hunt!</span></h1>
            <p>We're excited to have you join us on this adventure!</p>
          </div>
          <Routes>
            <Route path="/SignUp" element={<SignUp />}/>
            <Route path="/Login" element={<Login />}/> 
          </Routes>
        </div>
      </Router>    
  )
}

export default App;