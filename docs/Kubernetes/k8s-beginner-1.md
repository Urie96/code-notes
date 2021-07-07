---
title: Kubernetes(一)：本地搭建K8S三节点集群
date: 2021-06-30 19:13:23 GMT+0800
categories: [Kubernetes]
tags: [Kubernetes, Linux]
---

::: tip
本节通过虚拟机搭建一个具有一个 Master 节点，两个 Node 节点的 K8S 集群，便于了解各种组件。
:::

<!-- more -->

## 虚拟机安装 CentOS

1. 安装 [VirtualBox](https://www.virtualbox.org/wiki/Downloads)
2. 在[官网](https://www.centos.org/download/)下载对应的 CentOS7 镜像
3. 新建虚拟机，类型 Linux，版本 Red Hat(64-bit)，内存 2G，现在创建虚拟硬盘
4. 网络设置选择“桥接网卡”，选择能联网的网卡
5. 启动虚拟机，安装 CentOS 镜像，选择最小安装（不要图形界面），设置网络连接（重要），设置主机名，创建 Root 账户
6. 重启，`systemctl stop firewalld && systemctl disable firewalld`关闭防火墙，不然宿主机无法访问
7. `echo "UseDNS no">>/etc/ssh/sshd_config && systemctl restart sshd`关闭这个东西，不然宿主机 SSH 需要很长时间
8. `yum install ntpdate && ntpdate time.asia.apple.com`修正系统时间，否则后续会因为证书时间不对而提示 SSL 不安全
9. VirtualBox 无界面启动，宿主机 SSH 到虚拟机安装 zsh 等软件

## 搭建环境

- 安装 Docker：[官方文档](https://docs.docker.com/engine/install/centos/)

```sh
yum remove docker docker-client docker-client-latest docker-common docker-latest docker-latest-logrotate docker-logrotate docker-engine
yum install -y yum-utils
yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
yum install docker-ce docker-ce-cli containerd.io
systemctl enable docker && systemctl start docker
# 或者只运行  curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh
```

- 安装 kubelet、kubeadm、kubectl：[官方文档](https://kubernetes.io/zh/docs/setup/production-environment/tools/kubeadm/install-kubeadm/)

```sh
cat <<EOF | sudo tee /etc/yum.repos.d/kubernetes.repo
[kubernetes]
name=Kubernetes
baseurl=https://packages.cloud.google.com/yum/repos/kubernetes-el7-\$basearch
enabled=1
gpgcheck=1
repo_gpgcheck=1
gpgkey=https://packages.cloud.google.com/yum/doc/yum-key.gpg https://packages.cloud.google.com/yum/doc/rpm-package-key.gpg
exclude=kubelet kubeadm kubectl
EOF

# 将 SELinux 设置为 permissive 模式（相当于将其禁用）
sudo setenforce 0
sudo sed -i 's/^SELINUX=enforcing$/SELINUX=permissive/' /etc/selinux/config

sudo yum install -y kubelet kubeadm kubectl --disableexcludes=kubernetes

systemctl enable kubelet && systemctl start kubelet
```

## 复制虚拟机

- 复制虚拟机到三台（勾选上重新分配 MAC）分别命名为 Master、Node1、Node2-
- 将 Master 节点的 CPU 提升为双核
- 进入 Node1 查看是否能连接外网，不能的话`vi /etc/sysconfig/network-scripts/ifcfg-enp0s3`，随便修改 UUID，Node2 也同理
- 修改完后重启三台虚拟机，查看是否三台都能连外网，这时可能三台的 IP 都会变化
- `hostnamectl --static set-hostname node1.k8s`修改两台 Node 虚拟机的 hostname
- 进入宿主机添加三台虚拟机的 hosts，分别为 master.k8s、node1.k8s、node2.k8s
- 分别执行`ssh-copy-id -i ~/.ssh/id_rsa.pub root@master.k8s`实现 SSH 免密登录

## k8s 集群搭建

### Master 节点

```zsh
$ echo "1" >/proc/sys/net/bridge/bridge-nf-call-iptables
$ swapoff -a # 禁用交换分区，不然后续安装会报错
$ kubeadm init
Your Kubernetes control-plane has initialized successfully!

To start using your cluster, you need to run the following as a regular user:

  mkdir -p $HOME/.kube
  sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
  sudo chown $(id -u):$(id -g) $HOME/.kube/config

Alternatively, if you are the root user, you can run:

  export KUBECONFIG=/etc/kubernetes/admin.conf

You should now deploy a pod network to the cluster.
Run "kubectl apply -f [podnetwork].yaml" with one of the options listed at:
  https://kubernetes.io/docs/concepts/cluster-administration/addons/

Then you can join any number of worker nodes by running the following on each as root:

kubeadm join 10.79.41.23:6443 --token lg22bk.m3x8yob550dy5qct \
        --discovery-token-ca-cert-hash sha256:926616aac00bc3bda8cebcc2b8a44afb7fbc810a29f39dd76226b44a3e709b5f
$ echo "export KUBECONFIG=/etc/kubernetes/admin.conf">>/etc/profile
$ source /etc/profile
$ kubectl get node
NAME         STATUS   ROLES                  AGE    VERSION
master.k8s   NotReady    control-plane,master   101s   v1.21.2
$ kubectl apply -f https://docs.projectcalico.org/manifests/calico.yaml # 安装网络插件，不然节点一直是NotReady
$ k get po -n kube-system
NAME                                       READY   STATUS    RESTARTS   AGE
calico-kube-controllers-78d6f96c7b-lrvxp   1/1     Running   0          41s
calico-node-5vpv4                          1/1     Running   0          41s
coredns-558bd4d5db-hk2wx                   1/1     Running   0          3m59s
coredns-558bd4d5db-rdcct                   1/1     Running   0          3m59s
etcd-master.k8s                            1/1     Running   0          3m59s
kube-apiserver-master.k8s                  1/1     Running   0          3m59s
kube-controller-manager-master.k8s         1/1     Running   0          3m59s
kube-proxy-pvmn6                           1/1     Running   0          4m
kube-scheduler-master.k8s                  1/1     Running   0          3m59s
```

### Node1 节点与 Node2 节点

```zsh
$ echo "1" >/proc/sys/net/bridge/bridge-nf-call-iptables
$ echo "1" >/proc/sys/net/ipv4/ip_forward
$ kubeadm join 10.79.41.23:6443 --token lg22bk.m3x8yob550dy5qct \
        --discovery-token-ca-cert-hash sha256:926616aac00bc3bda8cebcc2b8a44afb7fbc810a29f39dd76226b44a3e709b5f
```

### 宿主机

```zsh
$ scp root@master.k8s:/etc/kubernetes/admin.conf ~/.kube/config
$ kubectl get nodes
NAME         STATUS   ROLES                  AGE   VERSION
master.k8s   Ready    control-plane,master   25m   v1.21.2
node1.k8s    Ready    <none>                 11m   v1.21.2
node2.k8s    Ready    <none>                 13m   v1.21.2
```
