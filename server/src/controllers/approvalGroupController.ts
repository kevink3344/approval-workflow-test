import { Request, Response, NextFunction } from 'express';
import * as approvalGroupService from '../services/approvalGroupService';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const groups = await approvalGroupService.listApprovalGroups();
    res.json(groups);
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const group = await approvalGroupService.getApprovalGroupById(req.params.id);
    if (!group) {
      res.status(404).json({ message: 'Approval group not found.' });
      return;
    }
    res.json(group);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, description, memberIds } = req.body;
    const group = await approvalGroupService.createApprovalGroup({
      name,
      description,
      memberIds,
      createdBy: req.user!.userId,
    });
    res.status(201).json(group);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const group = await approvalGroupService.updateApprovalGroup(
      req.params.id,
      req.body,
    );
    if (!group) {
      res.status(404).json({ message: 'Approval group not found.' });
      return;
    }
    res.json(group);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await approvalGroupService.deleteApprovalGroup(req.params.id);
    res.json({ message: 'Approval group deleted successfully.' });
  } catch (err) {
    next(err);
  }
}