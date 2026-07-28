import { Request, Response, NextFunction } from 'express';
import * as workflowService from '../services/workflowService';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.scopedOrganizationId ?? null;
    const workflows = await workflowService.listWorkflows(orgId, req.user!.role, req.user!.userId);
    res.json(workflows);
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const workflow = await workflowService.getWorkflowById(req.params.id);
    if (!workflow) {
      res.status(404).json({ message: 'Workflow not found.' });
      return;
    }
    res.json(workflow);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, description, status, categoryId, instructions, slots, columns } = req.body;
    const organizationId = req.scopedOrganizationId;
    if (!organizationId) {
      res.status(400).json({ message: 'Organization context required to create a workflow.' });
      return;
    }
    const workflow = await workflowService.createWorkflow({
      name,
      description,
      createdBy: req.user!.userId,
      organizationId,
      status,
      categoryId,
      instructions,
      slots,
      columns,
    });
    res.status(201).json(workflow);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const workflow = await workflowService.updateWorkflow(req.params.id, req.body);
    if (!workflow) {
      res.status(404).json({ message: 'Workflow not found.' });
      return;
    }
    res.json(workflow);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await workflowService.deleteWorkflow(req.params.id);
    res.json({ message: 'Workflow deleted successfully.' });
  } catch (err) {
    next(err);
  }
}