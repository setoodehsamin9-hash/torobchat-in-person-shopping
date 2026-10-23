import {describe,it,expect} from 'vitest';
import {reportedHoursSql} from '../src/lib/db/hours';
import {getHourStatus} from '../src/lib/domain';
import type {Hours} from '../src/lib/contracts';
const sentinel={start_time:'00:00:00',end_time:'00:00:00'};
const overnight={start_time:'20:00:00',end_time:'02:00:00'};
describe('reported schedule evidence used by ranking',()=>{
 it('does not treat a declared day containing only sentinel shifts as known evidence',()=>{
  const hours:Hours={thu:{status:'declared',shifts:[sentinel,sentinel]}};
  expect(getHourStatus(hours,'2026-10-22T08:00:00+03:30').state).toBe('unknown');
  const sql=reportedHoursSql('$1','$2','$3');
  // Ranking may count declared schedules only when at least one actual shift exists.
  expect(sql.known).toContain("shift->>'start_time'<>shift->>'end_time'");
 });
 it('counts a previous-day overnight continuation even when today only has sentinel shifts',()=>{
  const hours:Hours={wed:{status:'declared',shifts:[overnight]},thu:{status:'declared',shifts:[sentinel]}};
  expect(getHourStatus(hours,'2026-10-22T01:00:00+03:30').state).toBe('fits_reported');
  const sql=reportedHoursSql('$1','$2','$3');
  // Both score numerator and evidence denominator must consider yesterday.
  expect(sql.fits).toContain('s.weekly_hours->$2');
  expect(sql.known).toContain('s.weekly_hours->$2');
 });
 it('stops overnight evidence exactly at the end boundary',()=>{
  const hours:Hours={wed:{status:'declared',shifts:[overnight]}};
  expect(getHourStatus(hours,'2026-10-22T01:59:00+03:30').state).toBe('fits_reported');
  expect(getHourStatus(hours,'2026-10-22T02:00:00+03:30').state).toBe('unknown');
 });
 it('keeps explicit closure as known outside-hours evidence when no overnight shift continues',()=>{
  const hours:Hours={wed:{status:'declared',shifts:[overnight]},thu:{status:'closed',shifts:[sentinel]}};
  expect(getHourStatus(hours,'2026-10-22T01:00:00+03:30').state).toBe('fits_reported');
  expect(getHourStatus(hours,'2026-10-22T02:00:00+03:30').state).toBe('outside_reported');
 });
});
