import type { LoaderFunctionArgs } from "@remix-run/node";
import { vtoJobStatusLoader } from "../services/vto.server";

export const loader = (args: LoaderFunctionArgs) => vtoJobStatusLoader(args);
