/** SQL counterparts of getHourStatus; arguments are bound-parameter references. */
export function reportedHoursSql(day:string,previousDay:string,time:string):{known:string;fits:string} {
 const current=`s.weekly_hours->${day}`;
 const previous=`s.weekly_hours->${previousDay}`;
 const actualShifts=`EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(${current}->'shifts','[]'::jsonb)) shift WHERE shift->>'start_time'<>shift->>'end_time')`;
 const currentFits=`(${current}->>'status'='declared' AND EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(${current}->'shifts','[]'::jsonb)) shift WHERE shift->>'start_time'<>shift->>'end_time' AND ((shift->>'start_time'<shift->>'end_time' AND ${time}>=shift->>'start_time' AND ${time}<shift->>'end_time') OR (shift->>'start_time'>shift->>'end_time' AND ${time}>=shift->>'start_time'))))`;
 // A shift beginning yesterday remains reported evidence until its end today.
 const overnightFits=`(${previous}->>'status'='declared' AND EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(${previous}->'shifts','[]'::jsonb)) shift WHERE shift->>'start_time'>shift->>'end_time' AND ${time}<shift->>'end_time'))`;
 const fits=`COALESCE((${overnightFits} OR ${currentFits}),false)`;
 // A declared day with only equal start/end sentinels carries no hours evidence.
 const known=`COALESCE((${overnightFits} OR ${current}->>'status'='closed' OR (${current}->>'status'='declared' AND ${actualShifts})),false)`;
 return {known,fits};
}
