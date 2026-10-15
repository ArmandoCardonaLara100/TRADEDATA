'use client';

import {FormEvent, useState} from 'react';
import {CheckCircle2, MessageSquareQuote, ShieldCheck, Trash2} from 'lucide-react';

import {Button, ErrorMessage, Field, PageHeading, Panel} from '@/components/ui';
import {api, message} from '@/lib/client';
import {useLanguage, type MessageKey} from '@/lib/i18n';
import type {ReviewSubmission, ReviewWorkspace} from '@/types/reviews';

const statusKey:Record<ReviewSubmission['status'],MessageKey>={
  pending:'review.pending',
  approved:'review.approved',
  rejected:'review.rejected',
};

function reviewDate(value:string,language:'en'|'es') {
  return new Intl.DateTimeFormat(language==='es'?'es-MX':'en-US',{month:'short',day:'numeric',year:'numeric'}).format(new Date(value));
}

export function Review({initial,viewerId}:{initial:ReviewWorkspace;viewerId:string}) {
  const {language,t}=useLanguage();
  const [reviews,setReviews]=useState(initial.reviews);
  const [busy,setBusy]=useState(false);
  const [actionId,setActionId]=useState<string|null>(null);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form=event.currentTarget;
    setBusy(true);setError('');setNotice('');
    try {
      const review=await api<ReviewSubmission>('/api/reviews',{method:'POST',body:JSON.stringify({reviewText:String(new FormData(form).get('reviewText')||'')})});
      setReviews(current=>[review,...current]);
      form.reset();setNotice(t('review.submitted'));
    } catch (cause) {setError(message(cause));}
    finally {setBusy(false);}
  }

  async function moderate(id:string,action:'approve'|'reject') {
    setActionId(id);setError('');
    try {
      const review=await api<ReviewSubmission>(`/api/reviews/${id}`,{method:'PATCH',body:JSON.stringify({action})});
      setReviews(current=>current.map(item=>item.id===id?review:item));
    } catch (cause) {setError(message(cause));}
    finally {setActionId(null);}
  }

  async function remove(id:string) {
    if(!window.confirm(t('review.deleteConfirm')))return;
    setActionId(id);setError('');
    try {
      await api(`/api/reviews/${id}`,{method:'DELETE'});
      setReviews(current=>current.filter(item=>item.id!==id));
    } catch (cause) {setError(message(cause));}
    finally {setActionId(null);}
  }

  return <>
    <PageHeading eyebrow="YOUR VOICE" title="Share your review" description="Help shape TRADEDATA with an honest, useful review." />
    <div className="review-layout">
      <Panel title={t('review.formTitle')} description={t('review.formText')} className="review-form-panel">
        <form className="panel-body form-stack" onSubmit={submit}>
          <ErrorMessage error={error} />
          {notice&&<div className="notice review-notice" role="status"><CheckCircle2 size={17}/><span>{notice}</span></div>}
          <Field label={t('review.label')}>
            <textarea name="reviewText" rows={7} minLength={3} maxLength={1600} required placeholder={t('review.placeholder')} />
          </Field>
          <div className="dialog-actions"><Button type="submit" loading={busy}><MessageSquareQuote size={16}/>{t('review.submit')}</Button></div>
        </form>
      </Panel>
      <Panel title={initial.isAdmin?t('review.moderation'):t('review.mine')} description={initial.isAdmin?t('review.moderationText'):undefined} className="review-list-panel">
        <div className="review-list">
          {!reviews.length?<div className="review-empty"><MessageSquareQuote size={22}/><p>{t('review.none')}</p></div>:reviews.map(review=><article className="review-entry" key={review.id}>
            <div className="review-entry-meta"><div><strong>{review.reviewerName}</strong><span>{t('review.submittedOn')} · {reviewDate(review.submittedAt,language)}</span></div><span className={`review-status ${review.status}`}>{t(statusKey[review.status])}</span></div>
            <p>{review.reviewText}</p>
            {review.status==='approved'&&review.approvedAt&&<small>{t('review.approvedOn')} · {reviewDate(review.approvedAt,language)}</small>}
            {initial.isAdmin&&review.userId!==viewerId&&<div className="inline-actions review-actions">
              {review.status!=='approved'&&<Button variant="secondary" loading={actionId===review.id} onClick={()=>void moderate(review.id,'approve')}>{t('review.approve')}</Button>}
              {review.status!=='rejected'&&<Button variant="secondary" loading={actionId===review.id} onClick={()=>void moderate(review.id,'reject')}>{t('review.reject')}</Button>}
              <Button variant="danger" aria-label={t('review.delete')} loading={actionId===review.id} onClick={()=>void remove(review.id)}><Trash2 size={15}/>{t('review.delete')}</Button>
            </div>}
          </article>)}
        </div>
        {initial.isAdmin&&<div className="info-note review-admin-note"><ShieldCheck size={16}/><span>{t('review.adminOnly')}</span></div>}
      </Panel>
    </div>
  </>;
}
