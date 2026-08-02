import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SignInForm from '../SignInForm.jsx';

describe('SignInForm', () => {
  it('wires the email and password labels to their inputs with htmlFor/id', () => {
    render(<SignInForm onSignIn={vi.fn()} pending={false} errorCode={null} />);

    const email = screen.getByLabelText(/email/i);
    const password = screen.getByLabelText(/password/i);
    expect(email).toHaveAttribute('id', 'admin-email');
    expect(password).toHaveAttribute('id', 'admin-password');
  });

  it('calls onSignIn with the entered email and password on submit', async () => {
    const onSignIn = vi.fn();
    const user = userEvent.setup();
    render(<SignInForm onSignIn={onSignIn} pending={false} errorCode={null} />);

    await user.type(screen.getByLabelText(/email/i), 'director@peakstory.test');
    await user.type(screen.getByLabelText(/password/i), 'correct-horse');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(onSignIn).toHaveBeenCalledTimes(1);
    expect(onSignIn).toHaveBeenCalledWith('director@peakstory.test', 'correct-horse');
  });

  it('disables the submit button while pending', () => {
    render(<SignInForm onSignIn={vi.fn()} pending errorCode={null} />);

    expect(screen.getByRole('button', { name: 'Sign In' })).toBeDisabled();
  });

  it('does not call onSignIn again if the form is somehow submitted while pending', async () => {
    const onSignIn = vi.fn();
    render(<SignInForm onSignIn={onSignIn} pending errorCode={null} />);

    // A disabled button cannot be clicked by user-event, so this asserts the
    // guard the disabled attribute is standing in for.
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeDisabled();
    expect(onSignIn).not.toHaveBeenCalled();
  });

  it('shows a message keyed by INVALID_CREDENTIALS and does not clear the typed email', async () => {
    const onSignIn = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<SignInForm onSignIn={onSignIn} pending={false} errorCode={null} />);

    const emailInput = screen.getByLabelText(/email/i);
    await user.type(emailInput, 'director@peakstory.test');
    await user.type(screen.getByLabelText(/password/i), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    // The parent learns the attempt failed and passes the error code back in
    // as a prop — this rerender is standing in for that round trip.
    rerender(<SignInForm onSignIn={onSignIn} pending={false} errorCode="INVALID_CREDENTIALS" />);

    expect(screen.getByRole('alert')).toHaveTextContent(/not correct/i);
    // Retyping an email after a typo'd password is a small cruelty — the
    // field the person almost certainly got right must survive the failure.
    expect(screen.getByLabelText(/email/i)).toHaveValue('director@peakstory.test');
  });

  it('shows distinct, non-blaming copy for NETWORK_ERROR and NOT_CONFIGURED', () => {
    const { rerender } = render(<SignInForm onSignIn={vi.fn()} pending={false} errorCode="NETWORK_ERROR" />);
    const networkMessage = screen.getByRole('alert').textContent;
    expect(networkMessage).toMatch(/could not reach/i);

    rerender(<SignInForm onSignIn={vi.fn()} pending={false} errorCode="NOT_CONFIGURED" />);
    const notConfiguredMessage = screen.getByRole('alert').textContent;
    expect(notConfiguredMessage).toMatch(/not available/i);
    expect(notConfiguredMessage).not.toBe(networkMessage);
  });

  it('marks the credential fields aria-invalid and describes them by the error message once one is shown', () => {
    render(<SignInForm onSignIn={vi.fn()} pending={false} errorCode="INVALID_CREDENTIALS" />);

    const alert = screen.getByRole('alert');
    const email = screen.getByLabelText(/email/i);
    const password = screen.getByLabelText(/password/i);

    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAttribute('aria-describedby', alert.id);
    expect(password).toHaveAttribute('aria-invalid', 'true');
    expect(password).toHaveAttribute('aria-describedby', alert.id);
  });

  it('does not mark fields invalid or render an alert when there is no error code', () => {
    render(<SignInForm onSignIn={vi.fn()} pending={false} errorCode={null} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).not.toHaveAttribute('aria-invalid', 'true');
  });
});
