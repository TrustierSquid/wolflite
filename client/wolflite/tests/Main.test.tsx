import React from 'react';
import {render, screen} from '@testing-library/react'
import LoginCreate from "../src/pages/LoginPage"
import '@testing-library/jest-dom';

test('renders login form and hyperlinks inside', ()=> {
   render(<LoginCreate/>);
   expect(screen.getByPlaceholderText(/Username/i)).toBeInTheDocument()
   expect(screen.getByPlaceholderText(/Password/i)).toBeInTheDocument()

   // Hyperlinks
   expect(screen.getByRole('link', { name: /log in/i })).toHaveAttribute('href', '/login')
   expect(screen.getByRole('link', { name: /browse without an account/i })).toHaveAttribute('href', '/blog')
})
