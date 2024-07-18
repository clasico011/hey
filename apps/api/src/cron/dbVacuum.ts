import heyPg from '@hey/db/heyPg';
import logger from '@hey/helpers/logger';

const dbVacuum = async () => {
  if (process.env.NEXT_PUBLIC_LENS_NETWORK !== 'mainnet') {
    return;
  }

  try {
    await heyPg.query('VACUUM FULL');
    logger.info('[Cron] dbVacuum - Vacuumed database');
  } catch (error) {
    logger.error('[Cron] dbVacuum - Error vacuuming database', error);
  }
};

export default dbVacuum;
