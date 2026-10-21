import {handle, requireUser, HttpError} from '@/lib/server/http';
import {listCalendarTrades} from '@/lib/server/repository';
import {calendarMonthBounds} from '@/lib/analytics/calendar';

export const GET = (request: Request) => handle(async () => {
  const user = await requireUser();
  const params = new URL(request.url).searchParams;
  const month = params.get('month') || '';
  if (!calendarMonthBounds(month)) throw new HttpError(422, 'Choose a valid calendar month.');
  const trades = await listCalendarTrades(user.id, params.get('accountId') || '', month);
  return Response.json({trades}, {headers: {'Cache-Control': 'private, no-store'}});
});
