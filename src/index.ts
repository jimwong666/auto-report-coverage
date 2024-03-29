export interface ARCprops {
	coverageVariable?: string;
	interval?: number;
	reportURL?: string;
	successCallback?: () => void;
	failedCallback?: () => void;
	params?: Record<string, unknown>;
}

type Global = {
	__git_info__: {
		branch: string;
		commit_hash: string;
		last_commit_datetime: string;
		project_name: string;
		remote: string;
		version: string;
	};
	__coverage__: Record<string, unknown>;
} & Record<string, unknown>;

const global: Global = new Function("return this")();

// 上报覆盖率
const reportCoverage = (
	reportURL: string,
	coverageVariable: string,
	successCallback: () => void,
	failedCallback: () => void,
	params: Record<string, any>,
) => {
	const reportData = JSON.stringify({
		data: global[coverageVariable],
		increment_coverage_dir: global.__increment_coverage_dir__,
		relative_path_prefix: global.__relative_path_prefix__,
		...global.__git_info__,
		...params,
	});

	// 超过 64k 时就不能使用 keepalive 了...
	const fetchParams =
		reportData.length > 65536
			? {}
			: {
					keepalive: true,
			  };

	fetch(reportURL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json;charset=utf-8",
		},
		body: reportData,
		...fetchParams,
	})
		.then((res) => {
			if (!res.ok) {
				throw new Error("Network response was not ok");
			}
			return res.json();
		})
		.then((json) => {
			const { success, message } = json;
			if (success) {
				// 重置 coverage 统计数据
				const cocerageData = global[coverageVariable] as any;
				for (const i in cocerageData) {
					for (const r in cocerageData[i].b) {
						cocerageData[i].b[r].fill(0);
					}
					for (const m in cocerageData[i].f) {
						cocerageData[i].f[m] = 0;
					}
					for (const n in cocerageData[i].s) {
						cocerageData[i].s[n] = 0;
					}
				}
				successCallback();
			} else {
				throw new Error(message);
			}
		})
		.catch((err) => {
			console.log("Request Failed", err);
			failedCallback();
		});
};

const ARC = (props: ARCprops): void => {
	// 自动上报覆盖率

	// 1、定时上报
	const {
		interval = 5 * 60 * 1000,
		// 开发环境 reportURL
		reportURL = "http://localhost:8050/remote",
		coverageVariable = "__coverage__",
		successCallback = () => {},
		failedCallback = () => {},
		params = {},
	} = props || {};

	setInterval(() => {
		(document.visibilityState === "visible" || !document.hidden) &&
			reportCoverage(
				reportURL,
				coverageVariable,
				successCallback,
				failedCallback,
				params,
			);
	}, interval);

	// 2、页面关闭时上报
	window.onbeforeunload = () => {
		(document.visibilityState === "visible" || !document.hidden) &&
			reportCoverage(
				reportURL,
				coverageVariable,
				successCallback,
				failedCallback,
				params,
			);
	};
};

export default ARC;
