import type { ActionFunctionArgs } from "@remix-run/node";
import { vtoJobsAction, vtoJobsLoader } from "../services/vto.server";

export const action = (args: ActionFunctionArgs) => vtoJobsAction(args);
export const loader = () => vtoJobsLoader();
