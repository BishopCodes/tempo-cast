import { useEffect, useState } from "react";
import { getWorkTypes, type WorkType } from "../api/tempo";
import { handleError } from "../utils/error-handling";

export function useWorkTypes() {
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        const types = await getWorkTypes();
        if (mounted) {
          setWorkTypes(types);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          const error = err instanceof Error ? err : new Error("Failed to load work types");
          setError(error);
          await handleError(error, "Failed to load work types");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  return { workTypes, loading, error };
}
