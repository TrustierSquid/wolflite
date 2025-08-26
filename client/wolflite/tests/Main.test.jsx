import React from 'react';
import {render, fireEvent, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginCreate from "../src/assets/loginComponents/LoginCreate"
import '@testing-library/jest-dom';

test('renders login form and hyperlinks inside', ()=> {
   render(<LoginCreate/>);
   expect(screen.getByPlaceholderText(/Username/i)).toBeInTheDocument()
   expect(screen.getByPlaceholderText(/Password/i)).toBeInTheDocument()

   // Hyperlinks
   expect(screen.getByRole('link')).toHaveAttribute('href', '/login')
})
