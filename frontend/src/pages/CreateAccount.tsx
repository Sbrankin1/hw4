import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { Crest } from '../components/Logo'

const MIN_PASSWORD = 8

export default function CreateAccount() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const set = (key: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (form.password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`)
      return
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      await register({
        first_name: form.firstName,
        last_name: form.lastName,
        email: form.email,
        password: form.password,
      })
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container auth-page">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-crest">
          <Crest size={48} />
        </div>
        <h1>Join the pack</h1>
        <p className="auth-sub">Create a Campus Customs account to save your chats and favorites.</p>

        <div className="auth-row">
          <label>
            First name
            <input required autoComplete="given-name" value={form.firstName} onChange={set('firstName')} />
          </label>
          <label>
            Last name
            <input required autoComplete="family-name" value={form.lastName} onChange={set('lastName')} />
          </label>
        </div>
        <label>
          Email
          <input type="email" required autoComplete="email" value={form.email} onChange={set('email')} />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            autoComplete="new-password"
            minLength={MIN_PASSWORD}
            value={form.password}
            onChange={set('password')}
          />
        </label>
        <label>
          Confirm password
          <input type="password" required autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />
        </label>

        {error && <p className="notice notice-error">{error}</p>}

        <button type="submit" className="btn btn-block" disabled={busy}>
          {busy ? 'Creating account…' : 'Create Account'}
        </button>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  )
}
