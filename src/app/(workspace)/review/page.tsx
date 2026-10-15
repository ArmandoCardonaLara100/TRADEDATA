import {Review} from '@/features/review/review';
import {getReviewWorkspace} from '@/lib/server/repository';
import {requireUser} from '@/lib/server/http';

export default async function Page(){const user=await requireUser();return <Review initial={await getReviewWorkspace(user.id)} viewerId={user.id}/>;}
