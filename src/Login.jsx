import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link,useNavigate } from 'react-router-dom';
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loginError, setLoginError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };
  axios.defaults.withCredentials = true;

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Form submitted with data:", formData);
    try {
      const response = await axios.post('http://localhost:3001/Login', formData);
        console.log('Login response:', response.data.message);
        if(response.data.message){
          // Redirect to dashboard or another page upon successful login
          setLoginError(response.data.message);
        }
        else{
          setLoginError("Login failed. Please check your credentials.");
        }
    } catch (error) {
      console.error('Error during login:', error);
      setLoginError("Error during login. Please try again later.");
    }
  };

  useEffect(() => {
    axios.get("http://localhost:3001/Login").then((response) => {
      if (response.data.loggedIn == true) {
        setLoginError(response.data.user);
      }
    }).catch((error) => {
      console.error('Error fetching user data:', error);
    });
  }, []);

  return (
    <div className="login-container">
      <div className="login-form">
        <h2 className="login-title"></h2>
        <form action="/Login" method="POST" onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="email">Email:</label>
            <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} required />
          </div>
          <div className="input-group">
            <label htmlFor="password">Password:</label>
            <input type="password" id="password" name="password" value={formData.password} onChange={handleChange} required />
          </div>
          <button type="submit">Login</button>
        </form>
      </div>
    </div>
  );
};

export default Login;