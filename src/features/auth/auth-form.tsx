'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useState, type FormEvent} from 'react';
import {ArrowRight, ChartNoAxesCombined, Eye, EyeOff, ShieldCheck} from 'lucide-react';

import {Button, ErrorMessage, Field} from '@/components/ui';
import {authClient} from '@/lib/auth-client';
import {message} from '@/lib/client';

export function AuthForm({register = false}: {register?: boolean}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [show, setShow] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);

    try {
      const credentials = {
        email: String(form.get('email')).trim(),
        password: String(form.get('password')),
      };
      const result = register
        ? await authClient.signUp.email({...credentials, name: String(form.get('name')).trim()})
        : await authClient.signIn.email(credentials);
      if (result.error) throw new Error(result.error.message || 'Unable to sign in. Check your details.');
      router.push('/dashboard');
      router.refresh();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  return <div className="auth-page">
    <div className="auth-aside">
      <Link className="brand" href="/"><span className="brand-mark"><ChartNoAxesCombined size={23}/></span><span>TRADE<span className="brand-light">DATA</span></span></Link>
      <div className="auth-statement">
        <span className="eyebrow">YOUR EDGE IS IN THE DATA</span>
        <h1>A clearer view.<br/>A disciplined<br/><span>next move.</span></h1>
        <p>Understand your trading. Explore the probabilities. Keep emotion out of the equation.</p>
        <div className="auth-principles"><span>Data</span><span>Discipline</span><span>Probability</span><span>Transparency</span></div>
      </div>
      <div className="auth-foot"><ShieldCheck size={17}/>Your journal. Your private workspace.</div>
    </div>
    <main className="auth-main">
      <form className="auth-form" onSubmit={submit}>
        <div className="auth-mobile-brand">TRADEDATA</div>
        <span className="eyebrow">{register ? 'START WITH A CLEAN SLATE' : 'WELCOME BACK'}</span>
        <h2>{register ? 'Create your workspace' : 'Back to the bigger picture.'}</h2>
        <p>{register ? 'Build a trading record you can learn from.' : 'Sign in to your trading workspace.'}</p>
        <ErrorMessage error={error}/>
        {register && <Field label="Your name"><input name="name" autoComplete="name" placeholder="Armando Cardona" required maxLength={80}/></Field>}
        <Field label="Email address"><input name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={254}/></Field>
        <div className="field">
          <label htmlFor="password">Password</label>
          <div className="password-field">
            <input id="password" name="password" type={show ? 'text' : 'password'} autoComplete={register ? 'new-password' : 'current-password'} placeholder={register ? 'Create a secure password' : 'Enter your password'} minLength={register ? 12 : 1} maxLength={128} required/>
            {register && <small>At least 12 characters. Use a unique password.</small>}
            <button type="button" className="icon-button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)}>{show ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
          </div>
        </div>
        <Button loading={busy} className="full-width">{register ? 'Create workspace' : 'Sign in'}<ArrowRight size={17}/></Button>
        <p className="auth-switch">{register ? 'Already have a workspace?' : 'New to TRADEDATA?'} <Link href={register ? '/login' : '/register'}>{register ? 'Sign in' : 'Create an account'}</Link></p>
      </form>
      <div className="auth-main-foot">A place for analysis. Not trade recommendations.</div>
    </main>
  </div>;
}
