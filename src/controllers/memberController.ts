import type { Request, Response, NextFunction } from 'express';
import { getMembers, getMemberById, updateMemberById, deleteMemberById } from '../services/memberService.js';
import type { z } from 'zod';
import { updateMemberSchema } from '../schemas/memberSchemas.js';

/**
 * Returns the list of registered members.
 */
export const listMembersHandler = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const members = await getMembers();
    res.status(200).json({ success: true, data: { members } });
  } catch (error) {
    next(error);
  }
};

/**
 * Gets a single member by ID.
 */
export const getMemberByIdHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const idParam = req.params.id;
    if (!idParam) {
      res.status(400).json({ success: false, message: 'Member ID is required' });
      return;
    }
    const id = Number.parseInt(idParam, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid member ID' });
      return;
    }
    const member = await getMemberById(id);
    res.status(200).json({ success: true, data: member, message: 'Member retrieved successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Updates a member by ID.
 */
export const updateMemberHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const idParam = req.params.id;
    if (!idParam) {
      res.status(400).json({ success: false, message: 'Member ID is required' });
      return;
    }
    const id = Number.parseInt(idParam, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid member ID' });
      return;
    }
    const payload = req.body as z.infer<typeof updateMemberSchema>;
    const member = await updateMemberById(id, payload);
    res.status(200).json({ success: true, data: member, message: 'Member updated successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Deletes a member by ID.
 */
export const deleteMemberHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const idParam = req.params.id;
    if (!idParam) {
      res.status(400).json({ success: false, message: 'Member ID is required' });
      return;
    }
    const id = Number.parseInt(idParam, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid member ID' });
      return;
    }
    await deleteMemberById(id);
    res.status(200).json({ success: true, message: 'Member deleted successfully' });
  } catch (error) {
    next(error);
  }
};


