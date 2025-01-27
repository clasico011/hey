import prisma from "@hey/db/prisma/db/client";
import logger from "@hey/helpers/logger";
import type { Request, Response } from "express";
import catchedError from "src/helpers/catchedError";
import validateIsStaff from "src/helpers/middlewares/validateIsStaff";
import validateLensAccount from "src/helpers/middlewares/validateLensAccount";
import { invalidBody, noBody } from "src/helpers/responses";
import { object, string } from "zod";

interface ExtensionRequest {
  id: string;
  ids: string;
}

const validationSchema = object({
  id: string(),
  ids: string().regex(/0x[\dA-Fa-f]+/g)
});

export const post = [
  validateLensAccount,
  validateIsStaff,
  async (req: Request, res: Response) => {
    const { body } = req;

    if (!body) {
      return noBody(res);
    }

    const validation = validationSchema.safeParse(body);

    if (!validation.success) {
      return invalidBody(res);
    }

    const { id: permissionId, ids } = body as ExtensionRequest;

    try {
      const parsedIds = JSON.parse(ids) as string[];

      const profilePermissions = await prisma.profilePermission.findMany({
        where: { permissionId, profileId: { in: parsedIds } }
      });

      const idsToAssign = parsedIds.filter(
        (profileId) =>
          !profilePermissions.some(
            (profilePermission) => profilePermission.profileId === profileId
          )
      );

      const profilePermission = await prisma.profilePermission.createMany({
        data: idsToAssign.map((profileId) => ({ permissionId, profileId })),
        skipDuplicates: true
      });

      logger.info(`Bulk assigned permissions for ${parsedIds.length} profiles`);

      return res
        .status(200)
        .json({ assigned: profilePermission.count, success: true });
    } catch (error) {
      return catchedError(res, error);
    }
  }
];
