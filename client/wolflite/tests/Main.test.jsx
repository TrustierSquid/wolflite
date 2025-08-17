import React from 'react';
import {render, fireEvent, screen} from '@testing-library/react'
import Main from '../src/assets/login/Main';
import '@testing-library/jest-dom';

test('renders login form and hyperlinks inside', ()=> {
   render(<Main/>);
   expect(screen.getByPlaceholderText(/Username/i)).toBeInTheDocument()
   expect(screen.getByPlaceholderText(/Password/i)).toBeInTheDocument()

   // Hyperlinks
   expect(screen.getByRole('link')).toHaveAttribute('href', '/login')
})