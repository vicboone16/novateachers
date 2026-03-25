
-- Auto-generate game_events from beacon_points_ledger inserts
CREATE OR REPLACE FUNCTION public.auto_game_event_from_ledger()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_event_type text;
  v_classroom_id uuid;
BEGIN
  -- Determine event type
  IF NEW.entry_kind = 'checkpoint' THEN
    -- Checkpoint events are already written by the engine; skip duplicate
    RETURN NEW;
  ELSIF NEW.entry_kind = 'redemption' THEN
    v_event_type := 'reward_redeemed';
  ELSIF NEW.points < 0 THEN
    v_event_type := 'points_deducted';
  ELSE
    v_event_type := 'points_awarded';
  END IF;

  -- Try to find the student's classroom
  SELECT cgs.group_id INTO v_classroom_id
  FROM public.classroom_group_students cgs
  WHERE cgs.client_id = NEW.student_id
  LIMIT 1;

  -- Insert game event (fire-and-forget; don't block ledger insert on failure)
  BEGIN
    INSERT INTO public.game_events (
      agency_id, classroom_id, student_id, event_type, payload
    ) VALUES (
      NEW.agency_id,
      v_classroom_id,
      NEW.student_id,
      v_event_type,
      jsonb_build_object(
        'points', NEW.points,
        'source', NEW.source,
        'reason', NEW.reason,
        'entry_kind', NEW.entry_kind,
        'ledger_id', NEW.id
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Silently ignore; game events are non-critical
    NULL;
  END;

  RETURN NEW;
END;
$$;

-- Attach trigger (drop first to be idempotent)
DROP TRIGGER IF EXISTS trg_auto_game_event ON public.beacon_points_ledger;
CREATE TRIGGER trg_auto_game_event
  AFTER INSERT ON public.beacon_points_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_game_event_from_ledger();
