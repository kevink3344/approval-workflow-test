import { Request, Response, NextFunction } from 'express';
import * as approvalService from '../services/approvalService';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const approvals = await approvalService.listApprovals(
      req.user!.userId,
      req.user!.role,
    );
    res.json(approvals);
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const approval = await approvalService.getApprovalById(req.params.id);
    if (!approval) {
      res.status(404).json({ message: 'Approval request not found.' });
      return;
    }
    res.json(approval);
  } catch (err) {
    next(err);
  }
}

export async function submit(req: Request, res: Response, next: NextFunction) {
  try {
    const { workflowId, fields } = req.body;
    const approval = await approvalService.submitApproval({
      workflowId,
      requesterId: req.user!.userId,
      fields,
    });
    res.status(201).json(approval);
  } catch (err) {
    next(err);
  }
}

export async function actOnStep(req: Request, res: Response, next: NextFunction) {
  try {
    const { action, comment } = req.body;
    const approval = await approvalService.actOnStep(
      req.params.id,
      req.params.stepId,
      action,
      req.user!.userId,
      comment,
    );
    res.json(approval);
  } catch (err) {
    next(err);
  }
}

export async function cancel(req: Request, res: Response, next: NextFunction) {
  try {
    const approval = await approvalService.cancelApproval(
      req.params.id,
      req.user!.userId,
    );
    res.json(approval);
  } catch (err) {
    next(err);
  }
}